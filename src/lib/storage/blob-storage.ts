import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { put, del, head } from '@vercel/blob';
import { AudioStorageProvider, StoredAudio, AudioProcessingFile } from './types';
import { validateAudioFile } from './audio-utils';

export class VercelBlobAudioStorage implements AudioStorageProvider {
  readonly id = 'vercel-blob';
  readonly name = 'Vercel Blob Storage';
  private token?: string;

  constructor(token?: string) {
    this.token = token || process.env.BLOB_READ_WRITE_TOKEN;
  }

  private ensureToken(): string {
    const activeToken = this.token || process.env.BLOB_READ_WRITE_TOKEN;
    if (!activeToken) {
      throw new Error(
        'Vercel Blob storage is not configured. Please set the BLOB_READ_WRITE_TOKEN environment variable in your deployment settings.'
      );
    }
    return activeToken;
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<StoredAudio> {
    const token = this.ensureToken();

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
    const pathname = `audio/${safeFileName}`;

    try {
      const blob = await put(pathname, buffer, {
        access: 'public',
        token,
        contentType: mimeType,
      });

      return {
        id,
        fileName: safeFileName,
        originalName: path.basename(originalName),
        mimeType,
        fileSizeBytes: buffer.length,
        durationSeconds: 0, // In serverless blob uploads, duration is extracted from client or during transcription
        url: blob.url,
      };
    } catch (err: any) {
      console.error('Vercel Blob upload failed:', err);
      throw new Error(
        `Failed to upload audio to persistent object storage: ${err?.message || err}`
      );
    }
  }

  async get(
    id: string,
    fileName: string
  ): Promise<{
    stream?: NodeJS.ReadableStream | ReadableStream;
    buffer?: Buffer;
    url?: string;
    contentType: string;
    contentLength: number;
  } | null> {
    const token = this.ensureToken();
    const safeName = path.basename(fileName);
    const pathname = `audio/${safeName}`;

    try {
      // Query blob details
      const blobDetails = await head(pathname, { token });
      if (!blobDetails) return null;

      return {
        url: blobDetails.url,
        contentType: blobDetails.contentType || 'audio/webm',
        contentLength: blobDetails.size,
      };
    } catch (err) {
      console.warn(`Could not resolve blob for ${fileName}:`, err);
      return null;
    }
  }

  async delete(id: string, fileName: string): Promise<void> {
    const token = this.ensureToken();
    const safeName = path.basename(fileName);
    const pathname = `audio/${safeName}`;

    try {
      await del(pathname, { token });
    } catch (err) {
      console.warn(`Vercel Blob delete warning for ${fileName}:`, err);
    }
  }

  async getFilePathForProcessing(
    id: string,
    fileName: string
  ): Promise<AudioProcessingFile> {
    const token = this.ensureToken();
    const safeName = path.basename(fileName);
    const pathname = `audio/${safeName}`;

    // Download blob to temporary /tmp file
    const blobDetails = await head(pathname, { token });
    if (!blobDetails?.url) {
      throw new Error(`Blob not found in object storage: ${fileName}`);
    }

    const tmpDir = path.join('/tmp', 'voice2note-proc');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const tmpFilePath = path.join(tmpDir, `${id}-${safeName}`);

    const res = await fetch(blobDetails.url);
    if (!res.ok) {
      throw new Error(`Failed to download audio from object storage: ${res.statusText}`);
    }

    const arrayBuf = await res.arrayBuffer();
    fs.writeFileSync(tmpFilePath, Buffer.from(arrayBuf));

    return {
      filePath: tmpFilePath,
      cleanup: async () => {
        try {
          if (fs.existsSync(tmpFilePath)) {
            fs.unlinkSync(tmpFilePath);
          }
        } catch (cleanupErr) {
          console.warn(`Temporary processing file cleanup warning for ${tmpFilePath}:`, cleanupErr);
        }
      },
    };
  }
}
