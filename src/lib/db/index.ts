import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { VoiceNote, Transcript, NoteStatus, Extraction, TaskItem, VectorChunk } from '@/types';

export function getDatabaseConfig(): { dataDir: string; dbPath: string; isEphemeral: boolean } {
  if (process.env.SQLITE_DB_PATH) {
    const customPath = process.env.SQLITE_DB_PATH;
    return { dataDir: path.dirname(customPath), dbPath: customPath, isEphemeral: false };
  }

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
  );

  if (isServerless) {
    const serverlessDir = path.join('/tmp', 'voice2note-data');
    return {
      dataDir: serverlessDir,
      dbPath: path.join(serverlessDir, 'voice2note.db'),
      isEphemeral: true,
    };
  }

  const localDir = path.join(process.cwd(), 'data');
  return {
    dataDir: localDir,
    dbPath: path.join(localDir, 'voice2note.db'),
    isEphemeral: false,
  };
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const { dataDir, dbPath } = getDatabaseConfig();

  if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);
  try {
    db.pragma('journal_mode = WAL');
  } catch {
    db.pragma('journal_mode = DELETE');
  }
  db.pragma('foreign_keys = ON');

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      audio_file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      duration_seconds REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'uploading',
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      voice_note_id TEXT NOT NULL UNIQUE,
      raw_text TEXT NOT NULL,
      segments TEXT NOT NULL,
      detected_language TEXT,
      model_used TEXT NOT NULL,
      processing_time_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (voice_note_id) REFERENCES voice_notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS extractions (
      id TEXT PRIMARY KEY,
      voice_note_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL,
      tasks TEXT NOT NULL,
      ideas TEXT NOT NULL,
      decisions TEXT NOT NULL,
      people TEXT NOT NULL,
      topics TEXT NOT NULL,
      important_dates TEXT NOT NULL,
      model_used TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (voice_note_id) REFERENCES voice_notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS note_embeddings (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding BLOB NOT NULL,
      metadata TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (note_id) REFERENCES voice_notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_voice_notes_created_at ON voice_notes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_voice_notes_status ON voice_notes(status);
    CREATE INDEX IF NOT EXISTS idx_note_embeddings_note ON note_embeddings(note_id);
  `);

  // Safely add any new columns to extractions if previously created without them
  try {
    db.prepare(`ALTER TABLE extractions ADD COLUMN title TEXT NOT NULL DEFAULT ''`).run();
  } catch {}
  try {
    db.prepare(`ALTER TABLE extractions ADD COLUMN model_used TEXT NOT NULL DEFAULT ''`).run();
  } catch {}

  dbInstance = db;
  return dbInstance;
}

// -------------------------------------------------------------
// VoiceNote CRUD
// -------------------------------------------------------------

export function createVoiceNote(note: {
  id: string;
  title: string;
  audioFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  status?: NoteStatus;
}): VoiceNote {
  const db = getDb();
  const now = new Date().toISOString();
  const duration = note.durationSeconds ?? 0;
  const status = note.status ?? 'uploading';

  const stmt = db.prepare(`
    INSERT INTO voice_notes (id, title, audio_file_name, mime_type, file_size_bytes, duration_seconds, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(note.id, note.title, note.audioFileName, note.mimeType, note.fileSizeBytes, duration, status, now, now);

  return {
    id: note.id,
    title: note.title,
    audioFileName: note.audioFileName,
    mimeType: note.mimeType,
    fileSizeBytes: note.fileSizeBytes,
    durationSeconds: duration,
    status,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateVoiceNoteStatus(
  id: string,
  status: NoteStatus,
  errorMessage: string | null = null,
  durationSeconds?: number
): void {
  const db = getDb();
  const now = new Date().toISOString();

  if (durationSeconds !== undefined && durationSeconds > 0) {
    db.prepare(`
      UPDATE voice_notes 
      SET status = ?, error_message = ?, duration_seconds = ?, updated_at = ?
      WHERE id = ?
    `).run(status, errorMessage, durationSeconds, now, id);
  } else {
    db.prepare(`
      UPDATE voice_notes 
      SET status = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `).run(status, errorMessage, now, id);
  }
}

export function updateVoiceNoteTitle(id: string, title: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE voice_notes SET title = ?, updated_at = ? WHERE id = ?`).run(title, now, id);
}

export function getVoiceNote(id: string): (VoiceNote & { transcript?: Transcript | null; extraction?: Extraction | null }) | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM voice_notes WHERE id = ?`).get(id) as any;
  if (!row) return null;

  const transcriptRow = db.prepare(`SELECT * FROM transcripts WHERE voice_note_id = ?`).get(id) as any;
  let transcript: Transcript | null = null;
  if (transcriptRow) {
    transcript = {
      id: transcriptRow.id,
      voiceNoteId: transcriptRow.voice_note_id,
      rawText: transcriptRow.raw_text,
      segments: JSON.parse(transcriptRow.segments || '[]'),
      detectedLanguage: transcriptRow.detected_language,
      modelUsed: transcriptRow.model_used,
      processingTimeMs: transcriptRow.processing_time_ms,
      createdAt: transcriptRow.created_at,
    };
  }

  const extractionRow = db.prepare(`SELECT * FROM extractions WHERE voice_note_id = ?`).get(id) as any;
  let extraction: Extraction | null = null;
  if (extractionRow) {
    extraction = {
      id: extractionRow.id,
      voiceNoteId: extractionRow.voice_note_id,
      title: extractionRow.title || '',
      summary: extractionRow.summary,
      tasks: JSON.parse(extractionRow.tasks || '[]'),
      ideas: JSON.parse(extractionRow.ideas || '[]'),
      decisions: JSON.parse(extractionRow.decisions || '[]'),
      people: JSON.parse(extractionRow.people || '[]'),
      topics: JSON.parse(extractionRow.topics || '[]'),
      importantDates: JSON.parse(extractionRow.important_dates || '[]'),
      modelUsed: extractionRow.model_used || '',
      createdAt: extractionRow.created_at,
    };
  }

  return {
    id: row.id,
    title: row.title,
    audioFileName: row.audio_file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    durationSeconds: row.duration_seconds,
    status: row.status as NoteStatus,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    transcript,
    extraction,
  };
}

export function listVoiceNotes(limit = 50, offset = 0, statusFilter?: NoteStatus): VoiceNote[] {
  const db = getDb();
  let query = `
    SELECT vn.*, t.raw_text as transcript_preview, e.summary as summary_preview,
           e.tasks as tasks_json, e.topics as topics_json
    FROM voice_notes vn
    LEFT JOIN transcripts t ON vn.id = t.voice_note_id
    LEFT JOIN extractions e ON vn.id = e.voice_note_id
  `;
  const params: any[] = [];

  if (statusFilter) {
    query += ` WHERE vn.status = ?`;
    params.push(statusFilter);
  }

  query += ` ORDER BY vn.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map((row) => {
    let taskCount = 0;
    try {
      const parsedTasks = JSON.parse(row.tasks_json || '[]');
      taskCount = Array.isArray(parsedTasks) ? parsedTasks.length : 0;
    } catch {}

    let topicTags: string[] = [];
    try {
      const parsedTopics = JSON.parse(row.topics_json || '[]');
      topicTags = Array.isArray(parsedTopics) ? parsedTopics : [];
    } catch {}

    return {
      id: row.id,
      title: row.title,
      audioFileName: row.audio_file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      durationSeconds: row.duration_seconds,
      status: row.status as NoteStatus,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      summaryPreview: row.summary_preview || (row.transcript_preview ? row.transcript_preview.slice(0, 160) + (row.transcript_preview.length > 160 ? '...' : '') : null),
      taskCount,
      topicTags,
    };
  });
}

export function deleteVoiceNote(id: string): { audioFileName: string } | null {
  const db = getDb();
  const row = db.prepare(`SELECT audio_file_name FROM voice_notes WHERE id = ?`).get(id) as any;
  if (!row) return null;

  db.prepare(`DELETE FROM voice_notes WHERE id = ?`).run(id);
  return { audioFileName: row.audio_file_name };
}

// -------------------------------------------------------------
// Transcripts
// -------------------------------------------------------------

export function saveTranscript(data: {
  id: string;
  voiceNoteId: string;
  rawText: string;
  segments: any[];
  detectedLanguage?: string | null;
  modelUsed: string;
  processingTimeMs: number;
}): Transcript {
  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO transcripts (id, voice_note_id, raw_text, segments, detected_language, model_used, processing_time_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(voice_note_id) DO UPDATE SET
      raw_text = excluded.raw_text,
      segments = excluded.segments,
      detected_language = excluded.detected_language,
      model_used = excluded.model_used,
      processing_time_ms = excluded.processing_time_ms,
      created_at = excluded.created_at
  `);

  stmt.run(
    data.id,
    data.voiceNoteId,
    data.rawText,
    JSON.stringify(data.segments),
    data.detectedLanguage ?? null,
    data.modelUsed,
    data.processingTimeMs,
    now
  );

  return {
    id: data.id,
    voiceNoteId: data.voiceNoteId,
    rawText: data.rawText,
    segments: data.segments,
    detectedLanguage: data.detectedLanguage,
    modelUsed: data.modelUsed,
    processingTimeMs: data.processingTimeMs,
    createdAt: now,
  };
}

// -------------------------------------------------------------
// Extractions (Tasks, Ideas, Decisions, Summary)
// -------------------------------------------------------------

export function saveExtraction(data: {
  id: string;
  voiceNoteId: string;
  title: string;
  summary: string;
  tasks: TaskItem[];
  ideas: any[];
  decisions: any[];
  people: string[];
  topics: string[];
  importantDates: any[];
  modelUsed?: string;
}): Extraction {
  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO extractions (id, voice_note_id, title, summary, tasks, ideas, decisions, people, topics, important_dates, model_used, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(voice_note_id) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      tasks = excluded.tasks,
      ideas = excluded.ideas,
      decisions = excluded.decisions,
      people = excluded.people,
      topics = excluded.topics,
      important_dates = excluded.important_dates,
      model_used = excluded.model_used,
      created_at = excluded.created_at
  `);

  stmt.run(
    data.id,
    data.voiceNoteId,
    data.title,
    data.summary,
    JSON.stringify(data.tasks),
    JSON.stringify(data.ideas),
    JSON.stringify(data.decisions),
    JSON.stringify(data.people),
    JSON.stringify(data.topics),
    JSON.stringify(data.importantDates),
    data.modelUsed || '',
    now
  );

  return {
    id: data.id,
    voiceNoteId: data.voiceNoteId,
    title: data.title,
    summary: data.summary,
    tasks: data.tasks,
    ideas: data.ideas,
    decisions: data.decisions,
    people: data.people,
    topics: data.topics,
    importantDates: data.importantDates,
    modelUsed: data.modelUsed,
    createdAt: now,
  };
}

export function updateTaskStatus(voiceNoteId: string, taskId: string, completed: boolean): TaskItem[] | null {
  const db = getDb();
  const row = db.prepare(`SELECT tasks FROM extractions WHERE voice_note_id = ?`).get(voiceNoteId) as any;
  if (!row) return null;

  const tasks: TaskItem[] = JSON.parse(row.tasks || '[]');
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  task.completed = completed;
  db.prepare(`UPDATE extractions SET tasks = ? WHERE voice_note_id = ?`).run(JSON.stringify(tasks), voiceNoteId);
  return tasks;
}

// -------------------------------------------------------------
// Vector Embeddings & Similarity Search
// -------------------------------------------------------------

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function saveEmbeddingChunks(chunks: VectorChunk[]): void {
  const db = getDb();
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO note_embeddings (id, note_id, chunk_index, text, embedding, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((items: VectorChunk[]) => {
    for (const chunk of items) {
      const buffer = Buffer.from(new Float32Array(chunk.embedding).buffer);
      insertStmt.run(
        chunk.id,
        chunk.noteId,
        chunk.chunkIndex,
        chunk.text,
        buffer,
        JSON.stringify(chunk.metadata),
        chunk.createdAt
      );
    }
  });

  transaction(chunks);
}

export function deleteEmbeddingChunksForNote(noteId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM note_embeddings WHERE note_id = ?`).run(noteId);
}

export function searchVectorChunks(
  queryEmbedding: number[],
  topK = 5,
  minScore = 0.3,
  filterNoteId?: string
): Array<VectorChunk & { score: number }> {
  const db = getDb();
  let query = `SELECT * FROM note_embeddings`;
  const params: any[] = [];

  if (filterNoteId) {
    query += ` WHERE note_id = ?`;
    params.push(filterNoteId);
  }

  const rows = db.prepare(query).all(...params) as any[];
  const qVector = new Float32Array(queryEmbedding);

  const scoredResults: Array<VectorChunk & { score: number }> = [];

  for (const row of rows) {
    const rawBuffer = row.embedding as Buffer;
    const chunkVector = new Float32Array(
      rawBuffer.buffer,
      rawBuffer.byteOffset,
      rawBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT
    );

    const score = cosineSimilarity(qVector, chunkVector);

    if (score >= minScore) {
      scoredResults.push({
        id: row.id,
        noteId: row.note_id,
        chunkIndex: row.chunk_index,
        text: row.text,
        embedding: [], // Omit raw vector to save memory
        metadata: JSON.parse(row.metadata || '{}'),
        createdAt: row.created_at,
        score: Math.round(score * 1000) / 1000,
      });
    }
  }

  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults.slice(0, topK);
}

export function findRelatedNotes(
  noteId: string,
  topK = 3
): Array<{ noteId: string; noteTitle: string; score: number }> {
  const db = getDb();
  // Fetch chunks for the target note
  const sourceChunks = db.prepare(`SELECT embedding FROM note_embeddings WHERE note_id = ?`).all(noteId) as any[];
  if (sourceChunks.length === 0) return [];

  // Average vector for the note
  const rawBuf0 = sourceChunks[0].embedding as Buffer;
  const dim = rawBuf0.byteLength / Float32Array.BYTES_PER_ELEMENT;
  const avgVector = new Float32Array(dim);

  for (const sc of sourceChunks) {
    const buf = sc.embedding as Buffer;
    const v = new Float32Array(buf.buffer, buf.byteOffset, dim);
    for (let i = 0; i < dim; i++) {
      avgVector[i] += v[i] / sourceChunks.length;
    }
  }

  const matches = searchVectorChunks(Array.from(avgVector), 20, 0.4);
  const noteScores = new Map<string, { noteTitle: string; maxScore: number }>();

  for (const match of matches) {
    if (match.noteId === noteId) continue;
    const existing = noteScores.get(match.noteId);
    if (!existing || match.score > existing.maxScore) {
      noteScores.set(match.noteId, {
        noteTitle: match.metadata.noteTitle || 'Untitled Note',
        maxScore: match.score,
      });
    }
  }

  const results = Array.from(noteScores.entries()).map(([nId, data]) => ({
    noteId: nId,
    noteTitle: data.noteTitle,
    score: data.maxScore,
  }));

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

// -------------------------------------------------------------
// Stats & Settings
// -------------------------------------------------------------

export function getStats(): {
  totalNotes: number;
  totalDurationSeconds: number;
  processingCount: number;
  readyCount: number;
  failedCount: number;
} {
  const db = getDb();
  const totalNotes = (db.prepare(`SELECT COUNT(*) as count FROM voice_notes`).get() as any)?.count || 0;
  const totalDurationSeconds = (db.prepare(`SELECT SUM(duration_seconds) as total FROM voice_notes`).get() as any)?.total || 0;
  const processingCount = (db.prepare(`SELECT COUNT(*) as count FROM voice_notes WHERE status IN ('uploading', 'processing', 'transcribing', 'analyzing')`).get() as any)?.count || 0;
  const readyCount = (db.prepare(`SELECT COUNT(*) as count FROM voice_notes WHERE status = 'ready'`).get() as any)?.count || 0;
  const failedCount = (db.prepare(`SELECT COUNT(*) as count FROM voice_notes WHERE status = 'failed'`).get() as any)?.count || 0;

  return {
    totalNotes,
    totalDurationSeconds,
    processingCount,
    readyCount,
    failedCount,
  };
}

export function getSetting(key: string, defaultValue: string = ''): string {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as any;
  return row ? row.value : defaultValue;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
}
