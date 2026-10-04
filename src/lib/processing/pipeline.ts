import path from 'path';
import fs from 'fs';
import { getVoiceNote, updateVoiceNoteStatus, saveTranscript } from '@/lib/db';
import { AUDIO_STORAGE_DIR } from '@/lib/storage/audio';
import { getSpeechProvider } from '@/lib/ai/speech/provider';
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
    // 1. Locate audio file
    const audioPath = path.join(AUDIO_STORAGE_DIR, note.audioFileName);
    const normalizedWavPath = path.join(AUDIO_STORAGE_DIR, `${note.id}_16k.wav`);
    const targetPath = fs.existsSync(normalizedWavPath) ? normalizedWavPath : audioPath;

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Audio file does not exist on disk: ${note.audioFileName}`);
    }

    // 2. Transition state to 'transcribing'
    updateVoiceNoteStatus(noteId, 'transcribing');

    // 3. Run speech transcription
    const provider = getSpeechProvider();
    const result = await provider.transcribe({
      filePath: targetPath,
      mimeType: note.mimeType,
      durationSeconds: note.durationSeconds,
    });

    // 4. Save transcript
    const transcriptId = crypto.randomUUID();
    saveTranscript({
      id: transcriptId,
      voiceNoteId: noteId,
      rawText: result.text || '(No audible speech detected in recording)',
      segments: result.segments,
      detectedLanguage: result.language,
      modelUsed: result.modelUsed,
      processingTimeMs: result.processingTimeMs,
    });

    // 5. Update note duration if updated, and mark 'ready'
    const finalDuration = result.duration > 0 ? result.duration : note.durationSeconds;
    updateVoiceNoteStatus(noteId, 'ready', null, finalDuration);

  } catch (err: any) {
    console.error(`Pipeline failure for note ${noteId}:`, err);
    const message = err?.message || 'Unknown transcription error occurred';
    updateVoiceNoteStatus(noteId, 'failed', message);
  } finally {
    activeJobs.delete(noteId);
  }
}
