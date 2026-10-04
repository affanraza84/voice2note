import { describe, it, expect } from 'vitest';
import {
  createVoiceNote,
  getVoiceNote,
  updateVoiceNoteStatus,
  saveTranscript,
  deleteVoiceNote,
  listVoiceNotes,
} from '@/lib/db';
import crypto from 'crypto';

describe('Note Creation and State Transition Suite', () => {
  const testId = `test-${Date.now()}`;

  it('should create a voice note record with initial status', () => {
    const note = createVoiceNote({
      id: testId,
      title: 'Sprint Planning Voice Memo',
      audioFileName: `${testId}.webm`,
      mimeType: 'audio/webm',
      fileSizeBytes: 45000,
      durationSeconds: 12.5,
      status: 'processing',
    });

    expect(note.id).toBe(testId);
    expect(note.title).toBe('Sprint Planning Voice Memo');
    expect(note.status).toBe('processing');
    expect(note.durationSeconds).toBe(12.5);

    const fetched = getVoiceNote(testId);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Sprint Planning Voice Memo');
    expect(fetched?.status).toBe('processing');
  });

  it('should perform valid processing state transitions', () => {
    // 1. Transition to transcribing
    updateVoiceNoteStatus(testId, 'transcribing');
    let fetched = getVoiceNote(testId);
    expect(fetched?.status).toBe('transcribing');

    // 2. Save transcript and transition to ready
    const transcript = saveTranscript({
      id: crypto.randomUUID(),
      voiceNoteId: testId,
      rawText: 'We need to launch the new user onboarding flow next Tuesday.',
      segments: [
        {
          id: 'seg-1',
          start: 0.0,
          end: 4.5,
          text: 'We need to launch the new user onboarding flow next Tuesday.',
        },
      ],
      detectedLanguage: 'en',
      modelUsed: 'whisper-tiny.en',
      processingTimeMs: 450,
    });

    expect(transcript.rawText).toContain('onboarding flow');

    updateVoiceNoteStatus(testId, 'ready', null, 14.2);
    fetched = getVoiceNote(testId);
    expect(fetched?.status).toBe('ready');
    expect(fetched?.durationSeconds).toBe(14.2);
    expect(fetched?.transcript?.rawText).toBe(transcript.rawText);
  });

  it('should record failed transcription state with error message', () => {
    const failedId = `failed-${Date.now()}`;
    createVoiceNote({
      id: failedId,
      title: 'Corrupted Recording',
      audioFileName: `${failedId}.webm`,
      mimeType: 'audio/webm',
      fileSizeBytes: 100,
      status: 'processing',
    });

    updateVoiceNoteStatus(failedId, 'failed', 'Audio stream was truncated or corrupted');
    const note = getVoiceNote(failedId);
    expect(note?.status).toBe('failed');
    expect(note?.errorMessage).toBe('Audio stream was truncated or corrupted');

    // Cleanup
    deleteVoiceNote(failedId);
  });

  it('should list voice notes and cleanup test note', () => {
    const notes = listVoiceNotes(10, 0);
    expect(notes.length).toBeGreaterThan(0);
    const found = notes.find((n) => n.id === testId);
    expect(found).toBeDefined();

    // Delete note
    const deleted = deleteVoiceNote(testId);
    expect(deleted?.audioFileName).toBe(`${testId}.webm`);
    expect(getVoiceNote(testId)).toBeNull();
  });
});
