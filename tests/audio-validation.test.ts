import { describe, it, expect } from 'vitest';
import { validateAudioFile } from '@/lib/storage/audio';

describe('Audio Validation Suite', () => {
  it('should accept valid WebM audio', () => {
    const result = validateAudioFile({
      size: 1024 * 500, // 500KB
      type: 'audio/webm',
      name: 'recording.webm',
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept valid WAV audio with codecs in MIME', () => {
    const result = validateAudioFile({
      size: 1024 * 1024,
      type: 'audio/wav; codecs=0',
      name: 'voice.wav',
    });
    expect(result.valid).toBe(true);
  });

  it('should accept MP3 and M4A audio files', () => {
    expect(validateAudioFile({ size: 1000, type: 'audio/mpeg', name: 'memo.mp3' }).valid).toBe(true);
    expect(validateAudioFile({ size: 1000, type: 'audio/mp4', name: 'memo.m4a' }).valid).toBe(true);
    expect(validateAudioFile({ size: 1000, type: 'audio/x-m4a', name: 'memo.m4a' }).valid).toBe(true);
  });

  it('should reject empty audio files (0 bytes)', () => {
    const result = validateAudioFile({
      size: 0,
      type: 'audio/webm',
      name: 'empty.webm',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should reject oversized audio files (> 50MB)', () => {
    const result = validateAudioFile({
      size: 55 * 1024 * 1024, // 55MB
      type: 'audio/wav',
      name: 'huge.wav',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds the maximum limit');
  });

  it('should reject unsupported formats and malformed uploads', () => {
    const result1 = validateAudioFile({
      size: 1000,
      type: 'application/pdf',
      name: 'document.pdf',
    });
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain('Unsupported audio format');

    expect(
      validateAudioFile({
        size: 1000,
        type: 'video/mp4',
        name: 'movie.mp4',
      }).valid
    ).toBe(true);
    // .mp4 is audio/m4a container, but let's test an arbitrary binary file
    const result3 = validateAudioFile({
      size: 1000,
      type: 'text/plain',
      name: 'notes.txt',
    });
    expect(result3.valid).toBe(false);
  });
});
