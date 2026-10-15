import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  createVoiceNote,
  getVoiceNote,
  saveTranscript,
  saveExtraction,
  saveEmbeddingChunks,
  deleteVoiceNote,
  getDb,
} from '@/lib/db';
import { processVoiceNote, isJobActive } from '@/lib/processing/pipeline';
import { getSpeechProvider, setSpeechProvider } from '@/lib/ai/speech/provider';
import { getLLMProvider, setLLMProvider } from '@/lib/ai/llm/provider';
import { getEmbeddingProvider, setEmbeddingProvider } from '@/lib/ai/embeddings/provider';
import { getAudioStorage, setAudioStorage, deleteAudioFiles } from '@/lib/storage';
import { LocalAudioStorage } from '@/lib/storage/local-storage';
import { VercelBlobAudioStorage } from '@/lib/storage/blob-storage';
import { deleteClientNote } from '@/lib/storage/client-db';
import { SpeechProvider, LLMProvider, EmbeddingProvider } from '@/lib/ai/types';

describe('Pipeline Resilience, Deduplication & Comprehensive Deletion Suite', () => {
  const originalEnv = { ...process.env };
  const createdNoteIds: string[] = [];
  const createdAudioPaths: string[] = [];

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    // Reset providers
    setSpeechProvider(null);
    setLLMProvider(null);
    setEmbeddingProvider(null);
    setAudioStorage(null);

    // Clean up created notes and audio
    for (const id of createdNoteIds) {
      deleteVoiceNote(id);
    }
    createdNoteIds.length = 0;

    for (const filePath of createdAudioPaths) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
    }
    createdAudioPaths.length = 0;

    process.env = { ...originalEnv };
  });

  // Helper to create mock audio file
  function createTestAudioFile(noteId: string): string {
    const storageDir = path.join(process.cwd(), 'data', 'audio');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const filePath = path.join(storageDir, `${noteId}.wav`);
    fs.writeFileSync(filePath, Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00'));
    createdAudioPaths.push(filePath);
    return filePath;
  }

  describe('1. Failure Handling & Preventing Silent Success', () => {
    it('sets note status to failed when LLM extraction fails and preserves transcript', async () => {
      const noteId = `fail-llm-note-${Date.now()}`;
      createdNoteIds.push(noteId);
      createTestAudioFile(noteId);

      createVoiceNote({
        id: noteId,
        title: 'Team Roadmap Discussion',
        audioFileName: `${noteId}.wav`,
        mimeType: 'audio/wav',
        fileSizeBytes: 44,
        durationSeconds: 10,
        status: 'uploading',
      });

      // Mock working speech provider
      const mockSpeech: SpeechProvider = {
        id: 'mock-speech',
        name: 'Mock Speech',
        model: 'mock-whisper',
        isReady: async () => true,
        transcribe: async () => ({
          text: 'We agreed to ship the mobile notification feature by next Friday.',
          language: 'en',
          duration: 10,
          modelUsed: 'mock-whisper',
          processingTimeMs: 150,
          segments: [
            { id: 'seg-1', start: 0, end: 10, text: 'We agreed to ship the mobile notification feature by next Friday.' },
          ],
        }),
      };
      setSpeechProvider(mockSpeech);

      // Mock FAILING LLM provider
      const failingLLM: LLMProvider = {
        id: 'failing-llm',
        name: 'Failing Mock LLM',
        model: 'failing-model',
        isReady: async () => false, // Not online!
        generate: async () => {
          throw new Error('Connection refused to LLM backend');
        },
      };
      setLLMProvider(failingLLM);

      const result = await processVoiceNote(noteId);

      // 1. Pipeline result should reflect failure
      expect(result.success).toBe(false);
      expect(result.stages.transcription.status).toBe('success');
      expect(result.stages.extraction.status).toBe('failed');
      expect(result.stages.extraction.error).toContain('offline or unreachable');

      // 2. Database note MUST be marked as 'failed', NEVER 'ready'
      const updatedNote = getVoiceNote(noteId);
      expect(updatedNote?.status).toBe('failed');
      expect(updatedNote?.errorMessage).toContain('Extraction');

      // 3. Transcript MUST be preserved in database!
      expect(updatedNote?.transcript).toBeDefined();
      expect(updatedNote?.transcript?.rawText).toBe('We agreed to ship the mobile notification feature by next Friday.');
    });

    it('sets note status to failed when vector embedding fails and preserves transcript & extraction', async () => {
      const noteId = `fail-emb-note-${Date.now()}`;
      createdNoteIds.push(noteId);
      createTestAudioFile(noteId);

      createVoiceNote({
        id: noteId,
        title: 'Architecture Review',
        audioFileName: `${noteId}.wav`,
        mimeType: 'audio/wav',
        fileSizeBytes: 44,
        durationSeconds: 8,
        status: 'uploading',
      });

      // Mock speech provider
      setSpeechProvider({
        id: 'mock-speech',
        name: 'Mock Speech',
        model: 'mock-whisper',
        isReady: async () => true,
        transcribe: async () => ({
          text: 'Sarah agreed to migrate our database to SQLite next Monday.',
          language: 'en',
          duration: 8,
          modelUsed: 'mock-whisper',
          processingTimeMs: 100,
          segments: [{ id: 'seg-1', start: 0, end: 8, text: 'Sarah agreed to migrate our database to SQLite next Monday.' }],
        }),
      });

      // Mock working LLM provider
      setLLMProvider({
        id: 'mock-llm',
        name: 'Mock LLM',
        model: 'mock-llm',
        isReady: async () => true,
        generate: async () => JSON.stringify({
          title: 'Database Migration Strategy',
          summary: 'Sarah will migrate the database to SQLite next Monday.',
          tasks: [
            {
              title: 'Migrate database to SQLite',
              evidence: 'Sarah agreed to migrate our database to SQLite next Monday.',
              confidence: 0.95,
              dueDate: 'Next Monday',
              priority: 'high',
            },
          ],
          ideas: [],
          decisions: [
            {
              decision: 'Migrate to SQLite',
              evidence: 'agreed to migrate our database to SQLite',
            },
          ],
          people: ['Sarah'],
          topics: ['Database', 'SQLite'],
          importantDates: [{ event: 'Migration', date: 'Next Monday' }],
        }),
      });

      // Mock FAILING Embedding provider
      const failingEmbedder: EmbeddingProvider = {
        id: 'failing-embedder',
        name: 'Failing Embedder',
        dimensions: 384,
        embed: async () => {
          throw new Error('Embedding service OOM memory error');
        },
        embedBatch: async () => {
          throw new Error('Embedding batch failed: ONNX runtime crashed');
        },
      };
      setEmbeddingProvider(failingEmbedder);

      const result = await processVoiceNote(noteId);

      // Pipeline outcome
      expect(result.success).toBe(false);
      expect(result.stages.transcription.status).toBe('success');
      expect(result.stages.extraction.status).toBe('success');
      expect(result.stages.embedding.status).toBe('failed');
      expect(result.stages.embedding.error).toContain('ONNX runtime crashed');

      // Database note state MUST NOT be 'ready'
      const updatedNote = getVoiceNote(noteId);
      expect(updatedNote?.status).toBe('failed');
      expect(updatedNote?.errorMessage).toContain('Embedding');

      // Both transcript AND extraction should be safely preserved!
      expect(updatedNote?.transcript?.rawText).toContain('Sarah agreed to migrate');
      expect(updatedNote?.extraction?.title).toBe('Database Migration Strategy');
      expect(updatedNote?.extraction?.tasks).toHaveLength(1);
    });
  });

  describe('2. Safe Retry Behavior without Duplication', () => {
    it('retrying a failed note reuses transcript and does not duplicate transcripts, tasks, or embeddings', async () => {
      const noteId = `retry-note-${Date.now()}`;
      createdNoteIds.push(noteId);
      createTestAudioFile(noteId);

      createVoiceNote({
        id: noteId,
        title: 'Voice Note 123',
        audioFileName: `${noteId}.wav`,
        mimeType: 'audio/wav',
        fileSizeBytes: 44,
        durationSeconds: 15,
        status: 'uploading',
      });

      let speechCallCount = 0;
      setSpeechProvider({
        id: 'mock-speech',
        name: 'Mock Speech',
        model: 'mock-whisper',
        isReady: async () => true,
        transcribe: async () => {
          speechCallCount++;
          return {
            text: 'We should launch our product beta on Product Hunt on November 10.',
            language: 'en',
            duration: 15,
            modelUsed: 'mock-whisper',
            processingTimeMs: 120,
            segments: [
              { id: 'seg-1', start: 0, end: 15, text: 'We should launch our product beta on Product Hunt on November 10.' },
            ],
          };
        },
      });

      // Run 1: LLM fails
      setLLMProvider({
        id: 'mock-fail-llm',
        name: 'Mock Fail LLM',
        model: 'fail',
        isReady: async () => false,
        generate: async () => { throw new Error('Offline'); },
      });

      const firstRun = await processVoiceNote(noteId);
      expect(firstRun.success).toBe(false);
      expect(speechCallCount).toBe(1);

      // Verify 1 transcript in DB
      const db = getDb();
      const transcriptsCount1 = db.prepare('SELECT COUNT(*) as c FROM transcripts WHERE voice_note_id = ?').get(noteId) as any;
      expect(transcriptsCount1.c).toBe(1);

      // Run 2 (Retry): LLM is now online
      setLLMProvider({
        id: 'mock-success-llm',
        name: 'Mock Success LLM',
        model: 'success',
        isReady: async () => true,
        generate: async () => JSON.stringify({
          title: 'Product Hunt Launch Plan',
          summary: 'Product beta launch scheduled for November 10 on Product Hunt.',
          tasks: [
            {
              title: 'Prepare Product Hunt assets',
              evidence: 'launch our product beta on Product Hunt',
              confidence: 0.9,
              dueDate: 'November 10',
              priority: 'high',
            },
          ],
          ideas: [],
          decisions: [
            {
              decision: 'Launch on Product Hunt November 10',
              evidence: 'launch our product beta on Product Hunt on November 10',
            },
          ],
          people: [],
          topics: ['ProductHunt', 'Launch'],
          importantDates: [{ event: 'Beta Launch', date: 'November 10' }],
        }),
      });

      const retryRun = await processVoiceNote(noteId);

      // 1. Pipeline retry succeeds
      expect(retryRun.success).toBe(true);
      expect(retryRun.stages.transcription.status).toBe('skipped'); // Preserved, did not re-transcribe!
      expect(retryRun.stages.extraction.status).toBe('success');
      expect(retryRun.stages.embedding.status).toBe('success');
      expect(speechCallCount).toBe(1); // Speech provider was NOT called again

      // 2. Note status transitioned to 'ready'
      const finalNote = getVoiceNote(noteId);
      expect(finalNote?.status).toBe('ready');
      expect(finalNote?.errorMessage).toBeNull();
      expect(finalNote?.title).toBe('Product Hunt Launch Plan');

      // 3. Transcript record is NOT duplicated
      const transcriptsCount2 = db.prepare('SELECT COUNT(*) as c FROM transcripts WHERE voice_note_id = ?').get(noteId) as any;
      expect(transcriptsCount2.c).toBe(1);

      // 4. Extraction record is NOT duplicated
      const extractionsCount = db.prepare('SELECT COUNT(*) as c FROM extractions WHERE voice_note_id = ?').get(noteId) as any;
      expect(extractionsCount.c).toBe(1);
      expect(finalNote?.extraction?.tasks).toHaveLength(1);

      // 5. Embedding chunks are NOT duplicated
      const chunksCount = db.prepare('SELECT COUNT(*) as c FROM note_embeddings WHERE note_id = ?').get(noteId) as any;
      expect(chunksCount.c).toBeGreaterThan(0);
      const initialChunkCount = chunksCount.c;

      // Run 3: Second retry should keep exact same embedding and task count
      await processVoiceNote(noteId);
      const chunksCountAfterThirdRun = db.prepare('SELECT COUNT(*) as c FROM note_embeddings WHERE note_id = ?').get(noteId) as any;
      expect(chunksCountAfterThirdRun.c).toBe(initialChunkCount);
    });

    it('isJobActive accurately tracks job lifecycle and prevents concurrent duplicate execution', async () => {
      expect(isJobActive('concurrent-test-note')).toBe(false);

      const noteId = `concurrent-test-${Date.now()}`;
      createdNoteIds.push(noteId);
      createTestAudioFile(noteId);

      createVoiceNote({
        id: noteId,
        title: 'Concurrent Processing Note',
        audioFileName: `${noteId}.wav`,
        mimeType: 'audio/wav',
        fileSizeBytes: 44,
        durationSeconds: 10,
        status: 'uploading',
      });

      let resolveSlowSpeech: (res: any) => void;
      const slowSpeechPromise = new Promise((resolve) => {
        resolveSlowSpeech = resolve;
      });

      setSpeechProvider({
        id: 'slow-speech',
        name: 'Slow Speech',
        model: 'slow-whisper',
        isReady: async () => true,
        transcribe: async () => {
          await slowSpeechPromise;
          return {
            text: 'Completed slow speech.',
            language: 'en',
            duration: 10,
            modelUsed: 'slow-whisper',
            processingTimeMs: 500,
            segments: [],
          };
        },
      });

      // Start first process run (will wait on slowSpeechPromise)
      const firstRunPromise = processVoiceNote(noteId);

      // Verify note is marked active
      expect(isJobActive(noteId)).toBe(true);

      // Second concurrent attempt should immediately reject/skip duplicate execution
      const concurrentRunResult = await processVoiceNote(noteId);
      expect(concurrentRunResult.success).toBe(false);
      expect(concurrentRunResult.error).toContain('already being processed');

      // Now unblock the first run
      resolveSlowSpeech!({});
      await firstRunPromise;

      // After completion, note is no longer active
      expect(isJobActive(noteId)).toBe(false);
    });
  });

  describe('3. Comprehensive Note Deletion Cleanup', () => {
    it('deleting a voice note cleans up audio, transcript, extraction, and embeddings', async () => {
      const noteId = `full-del-note-${Date.now()}`;
      const audioPath = createTestAudioFile(noteId);
      expect(fs.existsSync(audioPath)).toBe(true);

      createVoiceNote({
        id: noteId,
        title: 'Note to be Deleted',
        audioFileName: `${noteId}.wav`,
        mimeType: 'audio/wav',
        fileSizeBytes: 44,
        durationSeconds: 5,
        status: 'ready',
      });

      saveTranscript({
        id: crypto.randomUUID(),
        voiceNoteId: noteId,
        rawText: 'This transcript should be wiped upon deletion.',
        segments: [],
        modelUsed: 'test',
        processingTimeMs: 50,
      });

      saveExtraction({
        id: crypto.randomUUID(),
        voiceNoteId: noteId,
        title: 'Delete Target',
        summary: 'Will be deleted.',
        tasks: [],
        ideas: [],
        decisions: [],
        people: [],
        topics: [],
        importantDates: [],
        modelUsed: 'test',
      });

      const embedder = getEmbeddingProvider();
      const emb = await embedder.embed('This transcript should be wiped upon deletion.');
      saveEmbeddingChunks([
        {
          id: `chunk-del-${noteId}`,
          noteId,
          chunkIndex: 0,
          text: 'This transcript should be wiped upon deletion.',
          embedding: emb,
          metadata: {
            noteId,
            noteTitle: 'Delete Target',
            chunkIndex: 0,
            createdAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
        },
      ]);

      const db = getDb();
      // Verify all tables contain the note data
      expect(db.prepare('SELECT COUNT(*) as c FROM transcripts WHERE voice_note_id = ?').get(noteId)).toHaveProperty('c', 1);
      expect(db.prepare('SELECT COUNT(*) as c FROM extractions WHERE voice_note_id = ?').get(noteId)).toHaveProperty('c', 1);
      expect(db.prepare('SELECT COUNT(*) as c FROM note_embeddings WHERE note_id = ?').get(noteId)).toHaveProperty('c', 1);

      // Perform deletion
      const deletedInfo = deleteVoiceNote(noteId);
      expect(deletedInfo?.audioFileName).toBe(`${noteId}.wav`);

      // Clean up physical audio
      await deleteAudioFiles(noteId, deletedInfo!.audioFileName);

      // 1. Note record deleted
      expect(getVoiceNote(noteId)).toBeNull();

      // 2. Transcript deleted
      const postTranscript = db.prepare('SELECT COUNT(*) as c FROM transcripts WHERE voice_note_id = ?').get(noteId) as any;
      expect(postTranscript.c).toBe(0);

      // 3. Extraction deleted
      const postExtraction = db.prepare('SELECT COUNT(*) as c FROM extractions WHERE voice_note_id = ?').get(noteId) as any;
      expect(postExtraction.c).toBe(0);

      // 4. Embeddings deleted
      const postEmbeddings = db.prepare('SELECT COUNT(*) as c FROM note_embeddings WHERE note_id = ?').get(noteId) as any;
      expect(postEmbeddings.c).toBe(0);

      // 5. Physical audio file deleted
      expect(fs.existsSync(audioPath)).toBe(false);
    });

    it('deleteClientNote cleans up localStorage fallback cache', async () => {
      const mockStorage: Record<string, string> = {
        v2n_cached_notes: JSON.stringify([
          { id: 'note-to-keep', title: 'Keep Me' },
          { id: 'note-to-delete', title: 'Delete Me' },
        ]),
      };

      // Mock window.localStorage
      const originalWindow = global.window;
      (global as any).window = {
        localStorage: {
          getItem: (key: string) => mockStorage[key] || null,
          setItem: (key: string, value: string) => {
            mockStorage[key] = value;
          },
          removeItem: (key: string) => {
            delete mockStorage[key];
          },
        },
      };

      await deleteClientNote('note-to-delete');

      const remaining = JSON.parse(mockStorage.v2n_cached_notes);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('note-to-keep');

      (global as any).window = originalWindow;
    });
  });

  describe('4. AI & Storage Provider Selection', () => {
    it('respects STORAGE_PROVIDER=local even when BLOB_READ_WRITE_TOKEN is set', () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test123';
      process.env.STORAGE_PROVIDER = 'local';
      setAudioStorage(null);

      const storage = getAudioStorage();
      expect(storage.id).toBe('local-fs');
      expect(storage instanceof LocalAudioStorage).toBe(true);
    });

    it('selects blob storage when STORAGE_PROVIDER=blob', () => {
      process.env.STORAGE_PROVIDER = 'blob';
      setAudioStorage(null);

      const storage = getAudioStorage();
      expect(storage.id).toBe('vercel-blob');
      expect(storage instanceof VercelBlobAudioStorage).toBe(true);
    });

    it('respects SPEECH_PROVIDER=local override', () => {
      process.env.SPEECH_PROVIDER = 'local';
      process.env.GROQ_API_KEY = 'gsk_test123';
      process.env.VERCEL = '1';
      setSpeechProvider(null);

      const provider = getSpeechProvider();
      expect(provider.id).toBe('local-whisper');
    });

    it('respects LLM_PROVIDER=local override', () => {
      process.env.LLM_PROVIDER = 'local';
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.VERCEL = '1';
      setLLMProvider(null);

      const provider = getLLMProvider();
      expect(provider.id).toBe('local-ollama');
    });
  });
});
