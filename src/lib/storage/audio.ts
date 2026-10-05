import fs from 'fs';
import path from 'path';
import { getAudioStorage } from './index';
import {
  MAX_AUDIO_FILE_SIZE_BYTES,
  SUPPORTED_AUDIO_MIME_TYPES,
  validateAudioFile,
  probeAudioDuration,
  transcodeTo16kHzWav,
} from './audio-utils';

export {
  getAudioStorage,
  MAX_AUDIO_FILE_SIZE_BYTES,
  SUPPORTED_AUDIO_MIME_TYPES,
  validateAudioFile,
  probeAudioDuration,
  transcodeTo16kHzWav,
};

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
);

export const AUDIO_STORAGE_DIR = isServerless
  ? path.join('/tmp', 'voice2note-data', 'audio')
  : path.join(process.cwd(), 'data', 'audio');

export function ensureStorageDirectories(): void {
  if (!fs.existsSync(AUDIO_STORAGE_DIR)) {
    fs.mkdirSync(AUDIO_STORAGE_DIR, { recursive: true });
  }
}

export interface StoredAudioMetadata {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  storedPath: string;
  normalizedWavPath?: string;
  url?: string;
}

export async function saveAudioBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<StoredAudioMetadata> {
  const storage = getAudioStorage();
  const stored = await storage.upload(buffer, originalName, mimeType);

  const normalizedWavPath = path.join(AUDIO_STORAGE_DIR, `${stored.id}_16k.wav`);

  return {
    id: stored.id,
    fileName: stored.fileName,
    originalName: stored.originalName,
    mimeType: stored.mimeType,
    fileSizeBytes: stored.fileSizeBytes,
    durationSeconds: stored.durationSeconds,
    storedPath: stored.storedPath || path.join(AUDIO_STORAGE_DIR, stored.fileName),
    normalizedWavPath: fs.existsSync(normalizedWavPath) ? normalizedWavPath : undefined,
    url: stored.url,
  };
}

export function getAudioFilePath(fileName: string): string | null {
  // Prevent directory traversal: strictly ensure clean filename without separators or parent directory references
  if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return null;
  }
  const safeName = path.basename(fileName);
  const fullPath = path.join(AUDIO_STORAGE_DIR, safeName);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

export function deleteAudioFiles(id: string, fileName: string): void {
  if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return;
  }
  const storage = getAudioStorage();
  storage.delete(id, fileName).catch((err) => {
    console.warn(`Audio deletion warning for ${fileName}:`, err);
  });
}
