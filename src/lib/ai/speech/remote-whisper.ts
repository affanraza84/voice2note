import fs from 'fs';
import path from 'path';
import { AudioInput, SpeechProvider, TranscriptResult, TranscriptSegment } from '../types';

export class RemoteSpeechProvider implements SpeechProvider {
  readonly id = 'remote-whisper';
  readonly name = 'Remote Whisper (OpenAI / Groq API)';
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(options?: { model?: string; apiKey?: string; baseUrl?: string }) {
    this.apiKey =
      options?.apiKey ||
      process.env.SPEECH_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      '';

    // Auto-detect base URL and model if using Groq
    if (process.env.GROQ_API_KEY && !options?.baseUrl && !process.env.SPEECH_BASE_URL) {
      this.baseUrl = 'https://api.groq.com/openai/v1';
      this.model = options?.model || process.env.SPEECH_MODEL || 'whisper-large-v3-turbo';
    } else {
      this.baseUrl = (
        options?.baseUrl ||
        process.env.SPEECH_BASE_URL ||
        process.env.AI_BASE_URL ||
        'https://api.openai.com/v1'
      ).replace(/\/$/, '');
      this.model = options?.model || process.env.SPEECH_MODEL || 'whisper-1';
    }
  }

  async isReady(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async transcribe(audio: AudioInput): Promise<TranscriptResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      throw new Error(
        'Remote speech transcription is not configured. Please set AI_API_KEY or GROQ_API_KEY in your production environment.'
      );
    }

    if (!fs.existsSync(audio.filePath)) {
      throw new Error(`Audio file not found at path: ${audio.filePath}`);
    }

    const fileBuffer = fs.readFileSync(audio.filePath);
    const fileName = path.basename(audio.filePath);
    const mimeType = audio.mimeType || 'audio/webm';

    // Create multipart form payload
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, fileName);
    formData.append('model', this.model);
    formData.append('response_format', 'verbose_json');

    const endpoint = `${this.baseUrl}/audio/transcriptions`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Remote speech transcription failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawText = (data.text || '').trim();
    const processingTimeMs = Date.now() - startTime;
    const duration = typeof data.duration === 'number' ? data.duration : (audio.durationSeconds || 0);

    const segments: TranscriptSegment[] = Array.isArray(data.segments)
      ? data.segments.map((seg: any, idx: number) => ({
          id: `seg-${idx}`,
          start: Math.round((seg.start ?? 0) * 10) / 10,
          end: Math.round((seg.end ?? (seg.start ?? 0) + 2) * 10) / 10,
          text: (seg.text || '').trim(),
        }))
      : [];

    if (segments.length === 0 && rawText.length > 0) {
      segments.push({
        id: 'seg-0',
        start: 0,
        end: Math.round(duration * 10) / 10,
        text: rawText,
      });
    }

    return {
      text: rawText,
      language: data.language || 'en',
      duration: Math.round(duration * 10) / 10,
      modelUsed: this.model,
      processingTimeMs,
      segments,
    };
  }
}
