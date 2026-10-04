export interface AudioInput {
  filePath: string;
  mimeType: string;
  durationSeconds?: number;
}

export interface TranscriptSegment {
  id?: string;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface TranscriptResult {
  text: string;
  language: string;
  duration: number;
  modelUsed: string;
  processingTimeMs: number;
  segments: TranscriptSegment[];
}

export interface SpeechProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  isReady(): Promise<boolean>;
  transcribe(audio: AudioInput): Promise<TranscriptResult>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  isReady(): Promise<boolean>;
  generate(messages: Message[], options?: GenerationOptions): Promise<string>;
  generateStream?(messages: Message[], options?: GenerationOptions): AsyncIterable<string>;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
