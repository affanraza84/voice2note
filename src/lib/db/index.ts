import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { VoiceNote, Transcript, NoteStatus, Extraction } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'voice2note.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
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
      summary TEXT NOT NULL,
      tasks TEXT NOT NULL,
      ideas TEXT NOT NULL,
      decisions TEXT NOT NULL,
      people TEXT NOT NULL,
      topics TEXT NOT NULL,
      important_dates TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (voice_note_id) REFERENCES voice_notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_voice_notes_created_at ON voice_notes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_voice_notes_status ON voice_notes(status);
  `);

  dbInstance = db;
  return dbInstance;
}

// Data Access Functions
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
      summary: extractionRow.summary,
      tasks: JSON.parse(extractionRow.tasks || '[]'),
      ideas: JSON.parse(extractionRow.ideas || '[]'),
      decisions: JSON.parse(extractionRow.decisions || '[]'),
      people: JSON.parse(extractionRow.people || '[]'),
      topics: JSON.parse(extractionRow.topics || '[]'),
      importantDates: JSON.parse(extractionRow.important_dates || '[]'),
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
    SELECT vn.*, t.raw_text as transcript_preview
    FROM voice_notes vn
    LEFT JOIN transcripts t ON vn.id = t.voice_note_id
  `;
  const params: any[] = [];

  if (statusFilter) {
    query += ` WHERE vn.status = ?`;
    params.push(statusFilter);
  }

  query += ` ORDER BY vn.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map((row) => ({
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
    summaryPreview: row.transcript_preview ? row.transcript_preview.slice(0, 160) + (row.transcript_preview.length > 160 ? '...' : '') : null,
  }));
}

export function deleteVoiceNote(id: string): { audioFileName: string } | null {
  const db = getDb();
  const row = db.prepare(`SELECT audio_file_name FROM voice_notes WHERE id = ?`).get(id) as any;
  if (!row) return null;

  db.prepare(`DELETE FROM voice_notes WHERE id = ?`).run(id);
  return { audioFileName: row.audio_file_name };
}

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
