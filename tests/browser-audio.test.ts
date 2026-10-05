import { describe, it, expect } from 'vitest';
import { validateRecordedBlob, encode16BitWavBlob } from '@/lib/audio/browser-audio';

describe('Browser Audio Preprocessing Suite', () => {
  describe('validateRecordedBlob', () => {
    it('should reject null or undefined blobs', () => {
      expect(validateRecordedBlob(null).valid).toBe(false);
      expect(validateRecordedBlob(null).error).toContain('No audio data');
    });

    it('should reject 0-byte empty blobs', () => {
      const emptyBlob = new Blob([], { type: 'audio/webm' });
      expect(validateRecordedBlob(emptyBlob).valid).toBe(false);
      expect(validateRecordedBlob(emptyBlob).error).toContain('0 bytes');
    });

    it('should reject tiny blobs (< 1024 bytes)', () => {
      const tinyBlob = new Blob([new Uint8Array(500)], { type: 'audio/webm' });
      expect(validateRecordedBlob(tinyBlob).valid).toBe(false);
      expect(validateRecordedBlob(tinyBlob).error).toContain('too short');
    });

    it('should accept valid blobs (>= 1024 bytes)', () => {
      const validBlob = new Blob([new Uint8Array(4096)], { type: 'audio/webm' });
      expect(validateRecordedBlob(validBlob).valid).toBe(true);
      expect(validateRecordedBlob(validBlob).error).toBeUndefined();
    });
  });

  describe('encode16BitWavBlob', () => {
    it('should generate a valid RIFF WAVE header with correct 16kHz mono format', async () => {
      const sampleCount = 16000; // 1 second of 16kHz audio
      const float32Samples = new Float32Array(sampleCount);
      // Generate a simple sine tone
      for (let i = 0; i < sampleCount; i++) {
        float32Samples[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
      }

      const wavBlob = encode16BitWavBlob(float32Samples, 16000);
      expect(wavBlob.type).toBe('audio/wav');
      expect(wavBlob.size).toBe(44 + sampleCount * 2);

      const buffer = await wavBlob.arrayBuffer();
      const view = new DataView(buffer);

      // Verify RIFF header
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      expect(riff).toBe('RIFF');

      // Verify WAVE identifier
      const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      expect(wave).toBe('WAVE');

      // Verify format chunk
      const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
      expect(fmt).toBe('fmt ');

      const audioFormat = view.getUint16(20, true);
      expect(audioFormat).toBe(1); // PCM

      const numChannels = view.getUint16(22, true);
      expect(numChannels).toBe(1); // Mono

      const sampleRate = view.getUint32(24, true);
      expect(sampleRate).toBe(16000); // 16kHz

      const bitsPerSample = view.getUint16(34, true);
      expect(bitsPerSample).toBe(16); // 16-bit

      // Verify data chunk
      const data = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));
      expect(data).toBe('data');

      const dataLength = view.getUint32(40, true);
      expect(dataLength).toBe(sampleCount * 2);
    });

    it('should clamp float samples between -1.0 and 1.0 to prevent 16-bit overflow', async () => {
      const overdriven = new Float32Array([1.5, -2.0, 0.0]);
      const wavBlob = encode16BitWavBlob(overdriven, 16000);
      const buffer = await wavBlob.arrayBuffer();
      const view = new DataView(buffer);

      // Offset 44: first sample (1.5 -> clipped to 1.0 -> 0x7fff = 32767)
      expect(view.getInt16(44, true)).toBe(32767);
      // Offset 46: second sample (-2.0 -> clipped to -1.0 -> -32768)
      expect(view.getInt16(46, true)).toBe(-32768);
      // Offset 48: zero
      expect(view.getInt16(48, true)).toBe(0);
    });
  });
});
