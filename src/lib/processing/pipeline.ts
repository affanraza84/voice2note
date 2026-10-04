import path from 'path';
import fs from 'fs';
import {
  getVoiceNote,
  updateVoiceNoteStatus,
  updateVoiceNoteTitle,
  saveTranscript,
  saveExtraction,
  saveEmbeddingChunks,
  deleteEmbeddingChunksForNote,
  getSetting,
} from '@/lib/db';
import { AUDIO_STORAGE_DIR } from '@/lib/storage/audio';
import { getSpeechProvider } from '@/lib/ai/speech/provider';
import { getLLMProvider } from '@/lib/ai/llm/provider';
import { getEmbeddingProvider } from '@/lib/ai/embeddings/provider';
import { buildExtractionPrompt } from '@/lib/ai/prompts';
import { validateExtraction } from '@/lib/ai/schemas';
import { chunkTranscriptAndMetadata } from '@/lib/rag/chunking';
import crypto from 'crypto';

// Active processing tasks tracker
const activeJobs = new Set<string>();

export function getActiveJobCount(): number {
  return activeJobs.size;
}

export function isJobActive(noteId: string): boolean {
  return activeJobs.has(noteId);
}

export async function processVoiceNote(noteId: string): Promise<void> {
  const note = getVoiceNote(noteId);
  if (!note) {
    throw new Error(`VoiceNote not found with id: ${noteId}`);
  }

  // Prevent duplicate concurrent runs for the same note
  if (activeJobs.has(noteId)) {
    console.log(`Note ${noteId} is already being processed.`);
    return;
  }

  activeJobs.add(noteId);

  try {
    // ---------------------------------------------------------
    // 1. Locate audio file
    // ---------------------------------------------------------
    const audioPath = path.join(AUDIO_STORAGE_DIR, note.audioFileName);
    const normalizedWavPath = path.join(AUDIO_STORAGE_DIR, `${note.id}_16k.wav`);
    const targetPath = fs.existsSync(normalizedWavPath) ? normalizedWavPath : audioPath;

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Audio file does not exist on disk: ${note.audioFileName}`);
    }

    // ---------------------------------------------------------
    // 2. Transcription Stage
    // ---------------------------------------------------------
    updateVoiceNoteStatus(noteId, 'transcribing');

    const speechProvider = getSpeechProvider();
    const result = await speechProvider.transcribe({
      filePath: targetPath,
      mimeType: note.mimeType,
      durationSeconds: note.durationSeconds,
    });

    const transcriptId = crypto.randomUUID();
    const savedTranscript = saveTranscript({
      id: transcriptId,
      voiceNoteId: noteId,
      rawText: result.text || '(No audible speech detected in recording)',
      segments: result.segments,
      detectedLanguage: result.language,
      modelUsed: result.modelUsed,
      processingTimeMs: result.processingTimeMs,
    });

    const finalDuration = result.duration > 0 ? result.duration : note.durationSeconds;
    updateVoiceNoteStatus(noteId, 'analyzing', null, finalDuration);

    // ---------------------------------------------------------
    // 3. Structured Intelligence Extraction Stage (Local LLM)
    // ---------------------------------------------------------
    let summaryText = 'Recording transcribed successfully.';
    let topicsList: string[] = [];

    const llm = getLLMProvider();
    const isLlmOnline = await llm.isReady();

    if (isLlmOnline && savedTranscript.rawText.length > 5) {
      const persona = {
        name: getSetting('FRIEND_NAME', 'Alex'),
        problem: getSetting('FRIEND_PROBLEM', ''),
        workflow: getSetting('FRIEND_WORKFLOW', ''),
      };

      const { system, user } = buildExtractionPrompt(savedTranscript.rawText, persona);

      try {
        const rawJsonOutput = await llm.generate(
          [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          { responseFormat: 'json', temperature: 0.1 }
        );

        const validation = validateExtraction(rawJsonOutput);

        if (validation.success && validation.data) {
          const data = validation.data;
          summaryText = data.summary;
          topicsList = data.topics;

          // If the note currently has a generic default title, apply the LLM's smart title
          const isGenericTitle =
            note.title.startsWith('Voice Note') ||
            note.title.startsWith('Recording-') ||
            note.title.trim() === '';

          if (isGenericTitle && data.title && data.title.trim().length > 0) {
            updateVoiceNoteTitle(noteId, data.title.trim());
          }

          // Format task items with UUIDs and sourceNoteId
          const tasks = data.tasks.map((t) => ({
            id: crypto.randomUUID(),
            title: t.title,
            sourceNoteId: noteId,
            evidence: t.evidence,
            confidence: t.confidence,
            dueDate: t.dueDate,
            completed: false,
            priority: t.priority,
          }));

          const ideas = data.ideas.map((i) => ({
            id: crypto.randomUUID(),
            idea: i.idea,
            evidence: i.evidence,
          }));

          const decisions = data.decisions.map((d) => ({
            id: crypto.randomUUID(),
            decision: d.decision,
            evidence: d.evidence,
          }));

          const importantDates = data.importantDates.map((dt) => ({
            event: dt.event,
            date: dt.date,
            evidence: dt.evidence,
          }));

          saveExtraction({
            id: crypto.randomUUID(),
            voiceNoteId: noteId,
            title: data.title,
            summary: data.summary,
            tasks,
            ideas,
            decisions,
            people: data.people,
            topics: data.topics,
            importantDates,
            modelUsed: llm.model,
          });
        }
      } catch (llmErr) {
        console.warn(`Extraction warning for note ${noteId} (will continue to vector indexing):`, llmErr);
      }
    }

    // ---------------------------------------------------------
    // 4. Vector Chunking & Embedding Ingestion Stage
    // ---------------------------------------------------------
    try {
      const refreshedNote = getVoiceNote(noteId);
      const activeTitle = refreshedNote?.title || note.title;

      const rawChunks = chunkTranscriptAndMetadata({
        noteId,
        noteTitle: activeTitle,
        transcript: savedTranscript,
        summary: summaryText,
        topics: topicsList,
        createdAt: note.createdAt,
      });

      if (rawChunks.length > 0) {
        const embedder = getEmbeddingProvider();
        const texts = rawChunks.map((c) => c.text);
        const embeddings = await embedder.embedBatch(texts);

        const vectorChunks = rawChunks.map((c, idx) => ({
          id: c.id,
          noteId: c.noteId,
          chunkIndex: c.chunkIndex,
          text: c.text,
          embedding: embeddings[idx],
          metadata: c.metadata,
          createdAt: note.createdAt,
        }));

        deleteEmbeddingChunksForNote(noteId);
        saveEmbeddingChunks(vectorChunks);
      }
    } catch (embErr) {
      console.warn(`Vector embedding warning for note ${noteId}:`, embErr);
    }

    // ---------------------------------------------------------
    // 5. Finalize status: 'ready'
    // ---------------------------------------------------------
    updateVoiceNoteStatus(noteId, 'ready', null, finalDuration);

  } catch (err: any) {
    console.error(`Pipeline failure for note ${noteId}:`, err);
    const message = err?.message || 'Unknown processing error occurred';
    updateVoiceNoteStatus(noteId, 'failed', message);
  } finally {
    activeJobs.delete(noteId);
  }
}
