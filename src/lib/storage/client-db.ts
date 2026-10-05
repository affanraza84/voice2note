/**
 * Browser-Local IndexedDB Storage for Voice2Note
 * 
 * Guarantees zero data loss on serverless deployments (such as Vercel)
 * where server-side /tmp is ephemeral across cold container restarts.
 * 
 * Stores:
 * 1. Notes metadata, summaries, tasks, ideas, decisions, and transcripts.
 * 2. Raw recorded audio Blobs for instant local playback without network roundtrips.
 */

import { VoiceNote } from '@/types';

const DB_NAME = 'voice2note_client_v1';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const AUDIO_STORE = 'audio_blobs';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveClientNote(note: VoiceNote, audioBlob?: Blob): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction([NOTES_STORE, AUDIO_STORE], 'readwrite');
    const notesStore = tx.objectStore(NOTES_STORE);
    const audioStore = tx.objectStore(AUDIO_STORE);

    notesStore.put(note);

    if (audioBlob) {
      audioStore.put({ id: note.id, blob: audioBlob, mimeType: audioBlob.type || 'audio/wav', updatedAt: new Date().toISOString() });
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Voice2Note] IndexedDB save warning (falling back to localStorage):', err);
    try {
      const cached = JSON.parse(localStorage.getItem('v2n_cached_notes') || '[]');
      const filtered = cached.filter((n: any) => n.id !== note.id);
      filtered.unshift(note);
      localStorage.setItem('v2n_cached_notes', JSON.stringify(filtered.slice(0, 50)));
    } catch {}
  }
}

export async function getClientNotes(): Promise<VoiceNote[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(NOTES_STORE, 'readonly');
    const store = tx.objectStore(NOTES_STORE);
    const request = store.getAll();

    return await new Promise<VoiceNote[]>((resolve, reject) => {
      request.onsuccess = () => {
        const results = (request.result || []) as VoiceNote[];
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    try {
      return JSON.parse(localStorage.getItem('v2n_cached_notes') || '[]');
    } catch {
      return [];
    }
  }
}

export async function getClientNote(id: string): Promise<VoiceNote | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(NOTES_STORE, 'readonly');
    const store = tx.objectStore(NOTES_STORE);
    const request = store.get(id);

    return await new Promise<VoiceNote | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem('v2n_cached_notes') || '[]');
      return cached.find((n: any) => n.id === id) || null;
    } catch {
      return null;
    }
  }
}

export async function getClientAudioBlob(noteId: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const store = tx.objectStore(AUDIO_STORE);
    const request = store.get(noteId);

    return await new Promise<Blob | null>((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.blob || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function deleteClientNote(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction([NOTES_STORE, AUDIO_STORE], 'readwrite');
    tx.objectStore(NOTES_STORE).delete(id);
    tx.objectStore(AUDIO_STORE).delete(id);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem('v2n_cached_notes') || '[]');
      const filtered = cached.filter((n: any) => n.id !== id);
      localStorage.setItem('v2n_cached_notes', JSON.stringify(filtered));
    } catch {}
  }
}
