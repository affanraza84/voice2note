import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const AUDIO_STORAGE_DIR = path.join(process.cwd(), 'data', 'audio');
export const MAX_AUDIO_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/m4a',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
]);

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
}

export function validateAudioFile(file: {
  size: number;
  type: string;
  name?: string;
  buffer?: Buffer;
}): { valid: boolean; error?: string } {
  if (file.size === 0) {
    return {
      valid: false,
      error: 'Audio file is empty (0 bytes). Please record or upload a valid audio recording.',
    };
  }

  if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum limit of 50 MB.`,
    };
  }

  // Security: Check for path traversal in original file name
  if (file.name && (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\'))) {
    return {
      valid: false,
      error: 'Invalid file name contains illegal path traversal characters.',
    };
  }

  // Normalize mime type (e.g. audio/webm;codecs=opus)
  const baseMime = file.type.split(';')[0].trim().toLowerCase();

  // Extension check if MIME type is generic
  if (!SUPPORTED_AUDIO_MIME_TYPES.has(baseMime)) {
    const ext = file.name ? path.extname(file.name).toLowerCase() : '';
    const knownExtensions = ['.webm', '.wav', '.mp3', '.m4a', '.mp4', '.aac', '.ogg', '.flac'];
    if (!knownExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Unsupported audio format "${file.type || ext}". Supported formats: WebM, WAV, MP3, M4A, AAC, OGG.`,
      };
    }
  }

  // Security: Basic magic bytes inspection against executable masquerading
  if (file.buffer && file.buffer.length >= 4) {
    const header = file.buffer.slice(0, 4);
    // Disallow Windows PE executables (MZ)
    if (header[0] === 0x4d && header[1] === 0x5a) {
      return { valid: false, error: 'Executable binaries are rejected.' };
    }
    // Disallow ELF binaries (\x7fELF)
    if (header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46) {
      return { valid: false, error: 'ELF binaries are rejected.' };
    }
    // Disallow script headers (#! or <?php or <script)
    const headerStr = file.buffer.slice(0, 16).toString('utf8');
    if (headerStr.startsWith('#!') || headerStr.startsWith('<?php') || headerStr.toLowerCase().includes('<script')) {
      return { valid: false, error: 'Script files are rejected.' };
    }
  }

  return { valid: true };
}

export async function probeAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-i',
      filePath,
      '-show_entries',
      'format=duration',
      '-v',
      'quiet',
      '-of',
      'csv=p=0',
    ]);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? 0 : Math.round(duration * 10) / 10;
  } catch {
    return 0;
  }
}

export async function transcodeTo16kHzWav(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-ar',
    '16000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);
}

export async function saveAudioBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<StoredAudioMetadata> {
  ensureStorageDirectories();

  // Validate buffer security
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
  const targetPath = path.join(AUDIO_STORAGE_DIR, safeFileName);

  fs.writeFileSync(targetPath, buffer);

  let durationSeconds = await probeAudioDuration(targetPath);

  // Transcode to normalized 16kHz mono WAV for Whisper
  const normalizedWavFileName = `${id}_16k.wav`;
  const normalizedWavPath = path.join(AUDIO_STORAGE_DIR, normalizedWavFileName);

  try {
    await transcodeTo16kHzWav(targetPath, normalizedWavPath);
    if (durationSeconds === 0) {
      durationSeconds = await probeAudioDuration(normalizedWavPath);
    }
  } catch (err) {
    console.warn('Transcode warning (will fallback to direct reading if wav):', err);
  }

  return {
    id,
    fileName: safeFileName,
    originalName: path.basename(originalName),
    mimeType,
    fileSizeBytes: buffer.length,
    durationSeconds,
    storedPath: targetPath,
    normalizedWavPath: fs.existsSync(normalizedWavPath) ? normalizedWavPath : undefined,
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
  const safeName = path.basename(fileName);
  const mainFile = path.join(AUDIO_STORAGE_DIR, safeName);
  const normalizedWav = path.join(AUDIO_STORAGE_DIR, `${id}_16k.wav`);

  if (fs.existsSync(mainFile)) {
    fs.unlinkSync(mainFile);
  }
  if (fs.existsSync(normalizedWav)) {
    fs.unlinkSync(normalizedWav);
  }
}
