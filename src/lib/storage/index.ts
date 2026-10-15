import { AudioStorageProvider } from './types';
import { LocalAudioStorage } from './local-storage';
import { VercelBlobAudioStorage } from './blob-storage';

export * from './types';
export * from './audio-utils';
export * from './audio';
export * from './local-storage';
export * from './blob-storage';

let activeStorage: AudioStorageProvider | null = null;

export function getAudioStorage(): AudioStorageProvider {
  if (activeStorage) {
    return activeStorage;
  }

  // Detect persistent object storage configuration
  const forceLocal = process.env.STORAGE_PROVIDER === 'local' || process.env.STORAGE_PROVIDER === 'fs';
  const forceBlob = process.env.STORAGE_PROVIDER === 'blob';
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (!forceLocal && (forceBlob || hasBlobToken)) {
    activeStorage = new VercelBlobAudioStorage();
  } else {
    activeStorage = new LocalAudioStorage();
  }

  return activeStorage;
}

export function setAudioStorage(storage: AudioStorageProvider | null): void {
  activeStorage = storage;
}
