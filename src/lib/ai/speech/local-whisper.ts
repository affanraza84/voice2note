import fs from 'fs';
import { AudioInput, SpeechProvider, TranscriptResult, TranscriptSegment } from '../types';
import { probeAudioDuration, transcodeTo16kHzWav } from '@/lib/storage/audio';

export class LocalSpeechProvider implements SpeechProvider {
  readonly id = 'local-whisper';
  readonly name = 'Local Whisper (ONNX / Transformers.js)';
  readonly model = 'Xenova/whisper-tiny.en';

  private transcriberPromise: Promise<any> | null = null;

  private async getTranscriber() {
    if (!this.transcriberPromise) {
      this.transcriberPromise = (async () => {
        const { pipeline, env } = await import('@xenova/transformers');
        const isServerless = Boolean(
          process.env.VERCEL ||
          process.env.AWS_LAMBDA_FUNCTION_NAME ||
          (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
        );
        if (isServerless) {
          env.cacheDir = '/tmp/transformers-cache';
        }
        return pipeline('automatic-speech-recognition', this.model, {
          quantized: true,
        });
      })();
    }
    return this.transcriberPromise;
  }

  async isReady(): Promise<boolean> {
    try {
      await this.getTranscriber();
      return true;
    } catch (err) {
      console.error('LocalSpeechProvider isReady failed:', err);
      return false;
    }
  }

  async transcribe(audio: AudioInput): Promise<TranscriptResult> {
    const startTime = Date.now();

    if (!fs.existsSync(audio.filePath)) {
      throw new Error(`Audio file not found at path: ${audio.filePath}`);
    }

    let wavPath = audio.filePath;
    let tempWavCreated = false;

    // Check if we need to transcode to 16kHz mono WAV
    if (!audio.filePath.endsWith('.wav')) {
      wavPath = audio.filePath + '.tmp.wav';
      try {
        await transcodeTo16kHzWav(audio.filePath, wavPath);
        tempWavCreated = true;
      } catch (err: any) {
        throw new Error(
          `Local audio conversion requires FFmpeg on your system (${err?.message || err}). In serverless/production deployments without FFmpeg, configure GROQ_API_KEY or AI_API_KEY to use remote speech recognition, or upload 16kHz WAV files.`
        );
      }
    }

    try {
      const transcriber = await this.getTranscriber();

      // Read audio file into 16kHz Float32Array using wavefile
      const wavefileMod = await import('wavefile');
      const WaveFile = (wavefileMod as any).WaveFile || (wavefileMod as any).default?.WaveFile || (wavefileMod as any).default;
      const buffer = fs.readFileSync(/*turbopackIgnore: true*/ wavPath);
      const wav = new WaveFile(buffer);
      
      wav.toBitDepth('32f');
      wav.toSampleRate(16000);
      let audioSamples = wav.getSamples();
      if (Array.isArray(audioSamples)) {
        audioSamples = audioSamples[0];
      }

      const duration = audio.durationSeconds && audio.durationSeconds > 0 
        ? audio.durationSeconds 
        : await probeAudioDuration(wavPath);

      // Run local whisper pipeline
      const output = await transcriber(audioSamples, {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      const rawText = (output.text || '').trim();
      const chunks = output.chunks || [];

      const segments: TranscriptSegment[] = chunks.map((chunk: any, index: number) => {
        const start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] ?? 0 : 0;
        const end = Array.isArray(chunk.timestamp) ? chunk.timestamp[1] ?? (start + 2) : 0;
        return {
          id: `seg-${index}`,
          start: Math.round(start * 10) / 10,
          end: Math.round(end * 10) / 10,
          text: (chunk.text || '').trim(),
        };
      });

      // If no chunks were returned but raw text exists, create a single segment
      if (segments.length === 0 && rawText.length > 0) {
        segments.push({
          id: 'seg-0',
          start: 0,
          end: Math.round(duration * 10) / 10,
          text: rawText,
        });
      }

      const lastSegmentEnd = segments.length > 0 ? segments[segments.length - 1].end : 0;
      const finalDuration = Math.max(duration, lastSegmentEnd);
      const processingTimeMs = Date.now() - startTime;

      return {
        text: rawText,
        language: 'en',
        duration: Math.round(finalDuration * 10) / 10,
        modelUsed: this.model,
        processingTimeMs,
        segments,
      };
    } catch (err: any) {
      console.error('Transcription execution error:', err);
      throw new Error(`Speech recognition error: ${err?.message || err}`);
    } finally {
      if (tempWavCreated && fs.existsSync(/*turbopackIgnore: true*/ wavPath)) {
        try {
          fs.unlinkSync(wavPath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }
}
