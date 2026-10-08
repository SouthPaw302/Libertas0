import {
  filterLibraryTracks,
  normalizePreparation,
  type LibraryQuery,
  type LibraryTrackPreparation,
} from './LibraryPreparation';

export interface LibraryTrack {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: number;
  lastModified: number;
  analysis?: unknown;
  preparation?: LibraryTrackPreparation;
}

export interface LibraryCrate {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface StoredLibraryTrack extends LibraryTrack {
  audio: Blob;
}

const DB_NAME = 'libertas0-library-v1';
const DB_VERSION = 2;
const TRACK_STORE = 'tracks';
const CRATE_STORE = 'crates';

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

function crateId(name: string): string {
  return `crate-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now().toString(36)}`;
}

export class TrackLibrary {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async importFile(file: File, analysis?: unknown): Promise<LibraryTrack> {
    const bytes = await file.arrayBuffer();
    const id = await sha256Hex(bytes);
    const existing = await this.getStored(id);
    const record: StoredLibraryTrack = {
      id,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      addedAt: existing?.addedAt ?? Date.now(),
      lastModified: file.lastModified,
      ...(existing?.preparation ? { preparation: existing.preparation } : {}),
      ...(analysis === undefined
        ? (existing?.analysis === undefined ? {} : { analysis: existing.analysis })
        : { analysis }),
      audio: new Blob([bytes], { type: file.type || 'application/octet-stream' }),
    };
    await this.putTrack(record);
    return this.publicRecord(record);
  }

  async importBlob(name: string, blob: Blob, lastModified = Date.now(), analysis?: unknown): Promise<LibraryTrack> {
    return this.importFile(new File([blob], name, { type: blob.type, lastModified }), analysis);
  }

  async list(): Promise<LibraryTrack[]> {
    const db = await this.db();
    const tx = db.transaction(TRACK_STORE, 'readonly');
    const values = await requestResult(tx.objectStore(TRACK_STORE).getAll() as IDBRequest<StoredLibraryTrack[]>);
    await transactionDone(tx);
    return values
      .map((record) => this.publicRecord(record))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async search(query: LibraryQuery): Promise<LibraryTrack[]> {
    return filterLibraryTracks(await this.list(), query);
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
    const stored = await this.requireStored(id);
    const next: StoredLibraryTrack = { ...stored, analysis };
    await this.putTrack(next);
    return this.publicRecord(next);
  }

  async updatePreparation(
    id: string,
    preparation: Partial<LibraryTrackPreparation>,
  ): Promise<LibraryTrack> {
    const stored = await this.requireStored(id);
    const merged: Partial<LibraryTrackPreparation> = {
      ...(stored.preparation ?? {}),
      ...preparation,
      metadata: {
        ...(stored.preparation?.metadata ?? {}),
        ...(preparation.metadata ?? {}),
      } as LibraryTrackPreparation['metadata'],
      tags: preparation.tags ?? stored.preparation?.tags ?? [],
      updatedAt: Date.now(),
    };
    const next: StoredLibraryTrack = {
      ...stored,
      preparation: normalizePreparation(stored.name, merged),
    };
    await this.putTrack(next);
    return this.publicRecord(next);
  }

  async clearPreparation(id: string): Promise<LibraryTrack> {
    const stored = await this.requireStored(id);
    const { preparation: _preparation, ...withoutPreparation } = stored;
    const next = withoutPreparation as StoredLibraryTrack;
    await this.putTrack(next);
    return this.publicRecord(next);
  }

  async createCrate(name: string): Promise<LibraryCrate> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Crate name is required');
    const db = await this.db();
    const now = Date.now();
    const crate: LibraryCrate = {
      id: crateId(trimmed),
      name: trimmed,
      trackIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const tx = db.transaction(CRATE_STORE, 'readwrite');
    tx.objectStore(CRATE_STORE).put(crate);
    await transactionDone(tx);
    return { ...crate, trackIds: [...crate.trackIds] };
  }

  async listCrates(): Promise<LibraryCrate[]> {
    const db = await this.db();
    const tx = db.transaction(CRATE_STORE, 'readonly');
    const crates = await requestResult(tx.objectStore(CRATE_STORE).getAll() as IDBRequest<LibraryCrate[]>);
    await transactionDone(tx);
    return crates
      .map((crate) => ({ ...crate, trackIds: [...crate.trackIds] }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async getCrate(id: string): Promise<LibraryCrate | null> {
    const db = await this.db();
    const tx = db.transaction(CRATE_STORE, 'readonly');
    const crate = await requestResult(tx.objectStore(CRATE_STORE).get(id) as IDBRequest<LibraryCrate | undefined>);
    await transactionDone(tx);
    return crate ? { ...crate, trackIds: [...crate.trackIds] } : null;
  }

  async addToCrate(crateIdValue: string, trackId: string): Promise<LibraryCrate> {
    await this.requireStored(trackId);
    const crate = await this.requireCrate(crateIdValue);
    if (!crate.trackIds.includes(trackId)) crate.trackIds.push(trackId);
    crate.updatedAt = Date.now();
    await this.putCrate(crate);
    return { ...crate, trackIds: [...crate.trackIds] };
  }

  async removeFromCrate(crateIdValue: string, trackId: string): Promise<LibraryCrate> {
    const crate = await this.requireCrate(crateIdValue);
    crate.trackIds = crate.trackIds.filter((id) => id !== trackId);
    crate.updatedAt = Date.now();
    await this.putCrate(crate);
    return { ...crate, trackIds: [...crate.trackIds] };
  }

  async deleteCrate(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(CRATE_STORE, 'readwrite');
    tx.objectStore(CRATE_STORE).delete(id);
    await transactionDone(tx);
  }

  async remove(id: string): Promise<void> {
    const db = await this.db();
    const trackTx = db.transaction(TRACK_STORE, 'readwrite');
    trackTx.objectStore(TRACK_STORE).delete(id);
    await transactionDone(trackTx);

    const crates = await this.listCrates();
    for (const crate of crates) {
      if (!crate.trackIds.includes(id)) continue;
      crate.trackIds = crate.trackIds.filter((trackId) => trackId !== id);
      crate.updatedAt = Date.now();
      await this.putCrate(crate);
    }
  }

  async clear(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([TRACK_STORE, CRATE_STORE], 'readwrite');
    tx.objectStore(TRACK_STORE).clear();
    tx.objectStore(CRATE_STORE).clear();
    await transactionDone(tx);
  }

  async close(): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    db.close();
    this.dbPromise = null;
  }

  private async requireStored(id: string): Promise<StoredLibraryTrack> {
    const stored = await this.getStored(id);
    if (!stored) throw new Error(`Library track not found: ${id}`);
    return stored;
  }

  private async getStored(id: string): Promise<StoredLibraryTrack | null> {
    const db = await this.db();
    const tx = db.transaction(TRACK_STORE, 'readonly');
    const value = await requestResult(tx.objectStore(TRACK_STORE).get(id) as IDBRequest<StoredLibraryTrack | undefined>);
    await transactionDone(tx);
    return value ?? null;
  }

  private async putTrack(record: StoredLibraryTrack): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(TRACK_STORE, 'readwrite');
    tx.objectStore(TRACK_STORE).put(record);
    await transactionDone(tx);
  }

  private async requireCrate(id: string): Promise<LibraryCrate> {
    const crate = await this.getCrate(id);
    if (!crate) throw new Error(`Library crate not found: ${id}`);
    return crate;
  }

  private async putCrate(crate: LibraryCrate): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(CRATE_STORE, 'readwrite');
    tx.objectStore(CRATE_STORE).put(crate);
    await transactionDone(tx);
  }

  private publicRecord(record: StoredLibraryTrack): LibraryTrack {
    const { audio: _audio, ...publicRecord } = record;
    return publicRecord;
  }

  private db(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(TRACK_STORE)) {
          db.createObjectStore(TRACK_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(CRATE_STORE)) {
          db.createObjectStore(CRATE_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open Libertas0 library'));
    });
    return this.dbPromise;
  }
}
