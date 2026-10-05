import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAudioStorage, setAudioStorage } from '@/lib/storage';
import { LocalAudioStorage, getLocalStorageDirectory } from '@/lib/storage/local-storage';
import { VercelBlobAudioStorage } from '@/lib/storage/blob-storage';

describe('Storage Abstraction & Serverless Path Resolution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.STORAGE_PROVIDER;
    delete process.env.VERCEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to LocalAudioStorage when no blob token is provided', () => {
    const storage = new LocalAudioStorage();
    expect(storage.id).toBe('local-fs');
    expect(storage.name).toContain('Local Filesystem');
  });

  it('resolves local storage directory to /tmp when running on Vercel serverless', () => {
    process.env.VERCEL = '1';
    const dir = getLocalStorageDirectory();
    expect(dir).toBe('/tmp/voice2note-data/audio');
    expect(dir).not.toContain('/var/task');
  });

  it('resolves local storage directory to ./data/audio on localhost development', () => {
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    const dir = getLocalStorageDirectory();
    expect(dir).toContain('data/audio');
  });

  it('instantiates VercelBlobAudioStorage when BLOB_READ_WRITE_TOKEN is set', () => {
    const blobStorage = new VercelBlobAudioStorage('vercel_blob_rw_test123');
    expect(blobStorage.id).toBe('vercel-blob');
    expect(blobStorage.name).toBe('Vercel Blob Storage');
  });

  it('throws a helpful, actionable error when Vercel Blob token is missing', async () => {
    const blobStorage = new VercelBlobAudioStorage('');
    const dummyBuffer = Buffer.from('RIFF....WAVE');
    await expect(blobStorage.upload(dummyBuffer, 'test.wav', 'audio/wav')).rejects.toThrow(
      /Vercel Blob storage is not configured/
    );
  });

  it('blocks path traversal attacks on local audio storage get()', async () => {
    const storage = new LocalAudioStorage();
    const result = await storage.get('id-1', '../../../etc/passwd');
    expect(result).toBeNull();
  });

  it('selects storage using getAudioStorage factory and allows setAudioStorage override', () => {
    const storage = getAudioStorage();
    expect(storage).toBeDefined();

    const customStorage = new LocalAudioStorage();
    setAudioStorage(customStorage);
    expect(getAudioStorage()).toBe(customStorage);
  });
});
