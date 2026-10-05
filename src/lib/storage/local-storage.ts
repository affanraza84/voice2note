import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AudioStorageProvider, StoredAudio, AudioProcessingFile } from './types';
import {
  validateAudioFile,
  probeAudioDuration,
  transcodeTo16kHzWav,
} from './audio-utils';

export function getLocalStorageDirectory(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production')
  );

  if (isServerless) {
    return path.join('/tmp', 'voice2note-data', 'audio');
  }

  return path.join(process.cwd(), 'data', 'audio');
}

export class LocalAudioStorage implements AudioStorageProvider {
  readonly id = 'local-fs';
  readonly name = 'Local Filesystem Storage';
  readonly baseDir: string;

  constructor(customDir?: string) {
    this.baseDir = customDir || getLocalStorageDirectory();
  }

  ensureDirectories(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<StoredAudio> {
    this.ensureDirectories();

    const validation = validateAudioFile({
      size: buffer.length,
      type: mimeType,
      name: originalName,
      buffer,
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Audio validation failed');
    }

    const id = crypto.randomUUID();
    const ext = path.extname(originalName) || (mimeType.includes('webm') ? '.webm' : '.wav');
    const safeFileName = `${id}${ext}`;
    const targetPath = path.join(this.baseDir, safeFileName);

    fs.writeFileSync(targetPath, buffer);

    let durationSeconds = await probeAudioDuration(targetPath);

    // Optional transcode to normalized 16kHz WAV for local Whisper
    const normalizedWavFileName = `${id}_16k.wav`;
    const normalizedWavPath = path.join(this.baseDir, normalizedWavFileName);

    try {
      await transcodeTo16kHzWav(targetPath, normalizedWavPath);
      if (durationSeconds === 0) {
        durationSeconds = await probeAudioDuration(normalizedWavPath);
      }
    } catch {
      // ffmpeg not installed or failed - speech provider will read directly or handle fallback
    }

    return {
      id,
      fileName: safeFileName,
      originalName: path.basename(originalName),
      mimeType,
      fileSizeBytes: buffer.length,
      durationSeconds,
      storedPath: targetPath,
      url: `/api/audio/${id}`,
    };
  }

  async get(
    id: string,
    fileName: string
  ): Promise<{
    stream?: NodeJS.ReadableStream;
    buffer?: Buffer;
    url?: string;
    contentType: string;
    contentLength: number;
  } | null> {
    // Prevent directory traversal
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return null;
    }

    const safeName = path.basename(fileName);
    const fullPath = path.join(this.baseDir, safeName);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const stat = fs.statSync(fullPath);
    const ext = path.extname(safeName).toLowerCase();
    const contentType =
      ext === '.wav' ? 'audio/wav' : ext === '.mp3' ? 'audio/mpeg' : ext === '.m4a' ? 'audio/mp4' : 'audio/webm';

    return {
      stream: fs.createReadStream(fullPath),
      contentType,
      contentLength: stat.size,
    };
  }

  async delete(id: string, fileName: string): Promise<void> {
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return;
    }

    const safeName = path.basename(fileName);
    const mainFile = path.join(this.baseDir, safeName);
    const normalizedWav = path.join(this.baseDir, `${id}_16k.wav`);

    if (fs.existsSync(mainFile)) {
      try {
        fs.unlinkSync(mainFile);
      } catch {}
    }

    if (fs.existsSync(normalizedWav)) {
      try {
        fs.unlinkSync(normalizedWav);
      } catch {}
    }
  }

  async getFilePathForProcessing(
    id: string,
    fileName: string
  ): Promise<AudioProcessingFile> {
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new Error(`Invalid audio filename: ${fileName}`);
    }

    const safeName = path.basename(fileName);
    const audioPath = path.join(this.baseDir, safeName);
    const normalizedWavPath = path.join(this.baseDir, `${id}_16k.wav`);

    const targetPath = fs.existsSync(normalizedWavPath) ? normalizedWavPath : audioPath;

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Audio file does not exist on disk: ${fileName}`);
    }

    return {
      filePath: targetPath,
      cleanup: async () => {
        // Local files are persistent, no temporary cleanup needed
      },
    };
  }
}
