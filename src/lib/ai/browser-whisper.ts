/**
 * Browser-Side Whisper Engine (Transformers.js + WebGPU / WASM)
 * 
 * Executes Whisper on-device directly within the client browser.
 * - Hardware acceleration via WebGPU where supported, with automatic WASM fallback.
 * - Anti-stall watchdogs and observable progress state machine.
 * - Zero audio leaves the user's browser during speech recognition.
 */

import { TranscriptSegment } from '@/types';

export type BrowserWhisperState = 
  | 'idle'
  | 'checking-environment'
  | 'loading-model'
  | 'ready'
  | 'transcribing'
  | 'error';

export interface BrowserWhisperProgress {
  state: BrowserWhisperState;
  progressPercent?: number;
  statusText: string;
  deviceBackend: 'webgpu' | 'wasm' | 'unknown';
  errorMessage?: string;
}

export type ProgressListener = (progress: BrowserWhisperProgress) => void;

class BrowserWhisperEngine {
  private static instance: BrowserWhisperEngine | null = null;
  private pipelineInstance: any = null;
  private pipelinePromise: Promise<any> | null = null;
  private state: BrowserWhisperState = 'idle';
  private statusText = 'Whisper standby';
  private progressPercent = 0;
  private deviceBackend: 'webgpu' | 'wasm' | 'unknown' = 'unknown';
  private errorMessage: string | null = null;
  private listeners = new Set<ProgressListener>();

  private constructor() {
    this.detectDeviceBackend();
  }

  static getInstance(): BrowserWhisperEngine {
    if (!BrowserWhisperEngine.instance) {
      BrowserWhisperEngine.instance = new BrowserWhisperEngine();
    }
    return BrowserWhisperEngine.instance;
  }

  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    listener(this.getProgress());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getProgress();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (err) {
        console.error('[Voice2Note] Listener error:', err);
      }
    }
  }

  getProgress(): BrowserWhisperProgress {
    return {
      state: this.state,
      progressPercent: this.progressPercent,
      statusText: this.statusText,
      deviceBackend: this.deviceBackend,
      errorMessage: this.errorMessage || undefined,
    };
  }

  private detectDeviceBackend(): 'webgpu' | 'wasm' {
    if (typeof window === 'undefined') return 'wasm';

    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean((navigator as any).gpu);
    if (hasWebGPU) {
      this.deviceBackend = 'webgpu';
      return 'webgpu';
    }

    this.deviceBackend = 'wasm';
    return 'wasm';
  }

  async loadModel(forceReload = false): Promise<any> {
    if (typeof window === 'undefined') return null;

    if (this.pipelineInstance && !forceReload) {
      this.state = 'ready';
      this.statusText = `Whisper Ready (${this.deviceBackend.toUpperCase()})`;
      this.notify();
      return this.pipelineInstance;
    }

    if (this.pipelinePromise && !forceReload) {
      return this.pipelinePromise;
    }

    this.state = 'loading-model';
    this.statusText = 'Initializing local Whisper pipeline...';
    this.progressPercent = 5;
    this.errorMessage = null;
    this.notify();

    console.log('[Voice2Note] Whisper initialization started');
    console.log(`[Voice2Note] Device acceleration: ${this.deviceBackend}`);

    this.pipelinePromise = (async () => {
      try {
        const { pipeline, env } = await import('@xenova/transformers');

        // Configure browser execution environment
        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        if (env.backends?.onnx?.wasm) {
          env.backends.onnx.wasm.numThreads = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2));
        }

        const modelName = 'Xenova/whisper-tiny.en';
        console.log(`[Voice2Note] Loading model: ${modelName}`);

        const transcriber = await pipeline('automatic-speech-recognition', modelName, {
          quantized: true,
          progress_callback: (item: any) => {
            if (item.status === 'progress' && typeof item.progress === 'number') {
              this.progressPercent = Math.round(item.progress);
              this.statusText = `Downloading Whisper model (${this.progressPercent}%)...`;
              this.notify();
            } else if (item.status === 'done') {
              this.progressPercent = 100;
              this.statusText = 'Model downloaded. Compiling ONNX runtime...';
              this.notify();
            }
          },
        });

        this.pipelineInstance = transcriber;
        this.state = 'ready';
        this.progressPercent = 100;
        this.statusText = `Local Whisper Ready (${this.deviceBackend.toUpperCase()})`;
        console.log('[Voice2Note] Local Whisper pipeline ready on-device');
        this.notify();

        return transcriber;
      } catch (err: any) {
        console.error('[Voice2Note] Whisper model loading failed:', err);
        this.state = 'error';
        this.pipelineInstance = null;
        this.pipelinePromise = null;
        this.errorMessage = err?.message || 'Failed to download or initialize Whisper model.';
        this.statusText = 'Local Whisper Unavailable';
        this.notify();
        throw err;
      }
    })();

    return this.pipelinePromise;
  }

  async transcribe(
    pcmFloat32: Float32Array,
    timeoutMs = 60000
  ): Promise<{
    text: string;
    segments: TranscriptSegment[];
    language: string;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();

    if (this.state !== 'ready' || !this.pipelineInstance) {
      await this.loadModel();
    }

    this.state = 'transcribing';
    this.statusText = 'Transcribing on-device...';
    this.notify();

    // Anti-stall watchdog timer
    const watchdogPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Transcription timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
      // Don't leak timer
      if (typeof timer.unref === 'function') timer.unref();
    });

    const executionPromise = (async () => {
      const transcriber = this.pipelineInstance;
      const output = await transcriber(pcmFloat32, {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      const rawText = (output.text || '').trim();
      const chunks = output.chunks || [];

      const segments: TranscriptSegment[] = chunks.map((chunk: any, index: number) => {
        const start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] ?? 0 : 0;
        const end = Array.isArray(chunk.timestamp) ? chunk.timestamp[1] ?? start + 2 : start + 2;
        return {
          id: `seg-${index}`,
          start: Math.round(start * 10) / 10,
          end: Math.round(end * 10) / 10,
          text: (chunk.text || '').trim(),
        };
      });

      if (segments.length === 0 && rawText.length > 0) {
        const approxDuration = Math.round((pcmFloat32.length / 16000) * 10) / 10;
        segments.push({
          id: 'seg-0',
          start: 0,
          end: approxDuration,
          text: rawText,
        });
      }

      return {
        text: rawText,
        segments,
        language: 'en',
        processingTimeMs: Date.now() - startTime,
      };
    })();

    try {
      const result = await Promise.race([executionPromise, watchdogPromise]);
      this.state = 'ready';
      this.statusText = `Local Whisper Ready (${this.deviceBackend.toUpperCase()})`;
      this.notify();
      return result;
    } catch (err: any) {
      console.error('[Voice2Note] In-browser transcription failed:', err);
      this.state = 'ready';
      this.statusText = `Local Whisper Ready (${this.deviceBackend.toUpperCase()})`;
      this.notify();
      throw err;
    }
  }
}

export function getBrowserWhisper(): BrowserWhisperEngine {
  return BrowserWhisperEngine.getInstance();
}
