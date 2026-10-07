import type {
  SamplerPadConfig,
  SamplerPadMode,
  SamplerSourceDeck,
} from './SamplerController';

export interface SamplerBankPad extends SamplerPadConfig {
  slot: number;
  name: string;
  type: string;
  size: number;
  addedAt: number;
  lastModified: number;
}

interface StoredSamplerPad extends SamplerBankPad {
  audio: Blob;
}

const DB_NAME = 'libertas0-sampler-v1';
const STORE = 'pads';
const PAD_COUNT = 8;

function validateSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 1 || slot > PAD_COUNT) {
    throw new RangeError(`sampler slot must be an integer from 1 to ${PAD_COUNT}`);
  }
}

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

export class SamplerBank {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async saveFile(
    slot: number,
    file: File,
    config: SamplerPadConfig,
  ): Promise<SamplerBankPad> {
    validateSlot(slot);
    const existing = await this.getStored(slot);
    const record: StoredSamplerPad = {
      slot,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      addedAt: existing?.addedAt ?? Date.now(),
      lastModified: file.lastModified,
      mode: config.mode,
      gain: config.gain,
      quantizeBeats: config.quantizeBeats,
      sourceDeck: config.sourceDeck,
      audio: new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' }),
    };
    await this.put(record);
    return this.publicRecord(record);
  }

  async saveBlob(
    slot: number,
    name: string,
    blob: Blob,
    config: SamplerPadConfig,
    lastModified = Date.now(),
  ): Promise<SamplerBankPad> {
    return this.saveFile(slot, new File([blob], name, { type: blob.type, lastModified }), config);
  }

  async updateConfig(
    slot: number,
    config: Partial<Pick<SamplerPadConfig, 'mode' | 'gain' | 'quantizeBeats' | 'sourceDeck'>>,
  ): Promise<SamplerBankPad> {
    validateSlot(slot);
    const stored = await this.getStored(slot);
    if (!stored) throw new Error(`Sampler bank pad not found: ${slot}`);
    const next: StoredSamplerPad = { ...stored, ...config };
    await this.put(next);
    return this.publicRecord(next);
  }

  async list(): Promise<SamplerBankPad[]> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readonly');
    const values = await requestResult(tx.objectStore(STORE).getAll() as IDBRequest<StoredSamplerPad[]>);
    await transactionDone(tx);
    return values.map((record) => this.publicRecord(record)).sort((a, b) => a.slot - b.slot);
  }

  async get(slot: number): Promise<SamplerBankPad | null> {
    const record = await this.getStored(slot);
    return record ? this.publicRecord(record) : null;
  }

  async getAudio(slot: number): Promise<ArrayBuffer> {
    const record = await this.getStored(slot);
    if (!record) throw new Error(`Sampler bank pad not found: ${slot}`);
    return record.audio.arrayBuffer();
  }

  async remove(slot: number): Promise<void> {
    validateSlot(slot);
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(slot);
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

  private async put(record: StoredSamplerPad): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    await transactionDone(tx);
  }

  private async getStored(slot: number): Promise<StoredSamplerPad | null> {
    validateSlot(slot);
    const db = await this.db();
    const tx = db.transaction(STORE, 'readonly');
    const value = await requestResult(
      tx.objectStore(STORE).get(slot) as IDBRequest<StoredSamplerPad | undefined>,
    );
    await transactionDone(tx);
    return value ?? null;
  }

  private publicRecord(record: StoredSamplerPad): SamplerBankPad {
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
          db.createObjectStore(STORE, { keyPath: 'slot' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open Libertas0 sampler bank'));
    });
    return this.dbPromise;
  }
}
