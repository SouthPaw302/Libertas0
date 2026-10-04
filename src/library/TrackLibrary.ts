export interface LibraryTrack {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: number;
  lastModified: number;
  analysis?: unknown;
}

interface StoredLibraryTrack extends LibraryTrack {
  audio: Blob;
}

const DB_NAME = 'libertas0-library-v1';
const STORE = 'tracks';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export class TrackLibrary {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async importFile(file: File, analysis?: unknown): Promise<LibraryTrack> {
    const bytes = await file.arrayBuffer();
    const id = await sha256Hex(bytes);
    const existing = await this.get(id);
    const record: StoredLibraryTrack = {
      id,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      addedAt: existing?.addedAt ?? Date.now(),
      lastModified: file.lastModified,
      ...(analysis === undefined ? {} : { analysis }),
      audio: new Blob([bytes], { type: file.type || 'application/octet-stream' }),
    };
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    await transactionDone(tx);
    return this.publicRecord(record);
  }

  async importBlob(name: string, blob: Blob, lastModified = Date.now(), analysis?: unknown): Promise<LibraryTrack> {
    return this.importFile(new File([blob], name, { type: blob.type, lastModified }), analysis);
  }

  async list(): Promise<LibraryTrack[]> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readonly');
    const values = await requestResult(tx.objectStore(STORE).getAll() as IDBRequest<StoredLibraryTrack[]>);
    await transactionDone(tx);
    return values
      .map((record) => this.publicRecord(record))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<LibraryTrack | null> {
    const stored = await this.getStored(id);
    return stored ? this.publicRecord(stored) : null;
  }

  async getAudio(id: string): Promise<ArrayBuffer> {
    const stored = await this.getStored(id);
    if (!stored) throw new Error(`Library track not found: ${id}`);
    return stored.audio.arrayBuffer();
  }

  async updateAnalysis(id: string, analysis: unknown): Promise<LibraryTrack> {
    const stored = await this.getStored(id);
    if (!stored) throw new Error(`Library track not found: ${id}`);
    const next: StoredLibraryTrack = { ...stored, analysis };
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(next);
    await transactionDone(tx);
    return this.publicRecord(next);
  }

  async remove(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await transactionDone(tx);
  }

  async clear(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await transactionDone(tx);
  }

  async close(): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    db.close();
    this.dbPromise = null;
  }

  private async getStored(id: string): Promise<StoredLibraryTrack | null> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readonly');
    const value = await requestResult(tx.objectStore(STORE).get(id) as IDBRequest<StoredLibraryTrack | undefined>);
    await transactionDone(tx);
    return value ?? null;
  }

  private publicRecord(record: StoredLibraryTrack): LibraryTrack {
    const { audio: _audio, ...publicRecord } = record;
    return publicRecord;
  }

  private db(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open Libertas0 library'));
    });
    return this.dbPromise;
  }
}
