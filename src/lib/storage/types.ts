export interface StoredAudio {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  url: string;
  storedPath?: string;
}

export interface AudioProcessingFile {
  filePath: string;
  cleanup: () => Promise<void>;
}

export interface AudioStorageProvider {
  readonly id: string;
  readonly name: string;

  upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<StoredAudio>;

  get(
    id: string,
    fileName: string
  ): Promise<{
    stream?: NodeJS.ReadableStream | ReadableStream;
    buffer?: Buffer;
    url?: string;
    contentType: string;
    contentLength: number;
  } | null>;

  delete(id: string, fileName: string): Promise<void>;

  getFilePathForProcessing(
    id: string,
    fileName: string
  ): Promise<AudioProcessingFile>;
}
