import { describe, it, expect } from 'vitest';
import { SpeechProvider, AudioInput, TranscriptResult } from '@/lib/ai/types';
import { LocalSpeechProvider } from '@/lib/ai/speech/local-whisper';
import { getSpeechProvider, setSpeechProvider } from '@/lib/ai/speech/provider';

describe('Speech Provider Abstraction Suite', () => {
  it('should return a default LocalSpeechProvider instance', () => {
    const provider = getSpeechProvider();
    expect(provider).toBeDefined();
    expect(provider.id).toBe('local-whisper');
    expect(provider.name).toContain('Local Whisper');
    expect(provider.model).toBe('Xenova/whisper-tiny.en');
  });

  it('should allow registering a pluggable mock speech provider', async () => {
    class MockSpeechProvider implements SpeechProvider {
      readonly id = 'mock-speech';
      readonly name = 'Mock Speech Engine';
      readonly model = 'mock-model-v1';

      async isReady(): Promise<boolean> {
        return true;
      }

      async transcribe(_audio: AudioInput): Promise<TranscriptResult> {
        return {
          text: 'This is a test transcript from mock provider.',
          language: 'en',
          duration: 3.5,
          modelUsed: this.model,
          processingTimeMs: 120,
          segments: [
            {
              id: 'seg-0',
              start: 0.0,
              end: 3.5,
              text: 'This is a test transcript from mock provider.',
            },
          ],
        };
      }
    }

    const mock = new MockSpeechProvider();
    setSpeechProvider(mock);

    const active = getSpeechProvider();
    expect(active.id).toBe('mock-speech');

    const result = await active.transcribe({
      filePath: '/dev/null',
      mimeType: 'audio/wav',
    });

    expect(result.text).toBe('This is a test transcript from mock provider.');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].start).toBe(0.0);
    expect(result.segments[0].end).toBe(3.5);

    // Reset back to local provider
    setSpeechProvider(new LocalSpeechProvider());
  });

  it('should throw an informative error when audio file does not exist', async () => {
    const provider = new LocalSpeechProvider();
    await expect(
      provider.transcribe({
        filePath: '/non/existent/audio_file_12345.wav',
        mimeType: 'audio/wav',
      })
    ).rejects.toThrow('Audio file not found');
  });
});
