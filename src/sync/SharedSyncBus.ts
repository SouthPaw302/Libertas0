export const SYNC_SHARED_BYTES = 64;

export interface SyncSharedSnapshot {
  outputFrame: number;
  sourceFrame: number;
  effectiveRate: number;
  sourceSampleRate: number;
  bpm: number;
  firstBeatFrame: number;
  playing: boolean;
}

export function createSyncSharedBuffer(): SharedArrayBuffer {
  if (typeof SharedArrayBuffer === 'undefined') {
    throw new Error('SYNC shared memory is unavailable');
  }
  return new SharedArrayBuffer(SYNC_SHARED_BYTES);
}

export function writeSyncSnapshot(
  buffer: SharedArrayBuffer,
  snapshot: SyncSharedSnapshot,
): void {
  const seq = new Int32Array(buffer, 0, 1);
  const data = new Float64Array(buffer, 8, 7);
  Atomics.add(seq, 0, 1);
  data[0] = snapshot.outputFrame;
  data[1] = snapshot.sourceFrame;
  data[2] = snapshot.effectiveRate;
  data[3] = snapshot.sourceSampleRate;
  data[4] = snapshot.bpm;
  data[5] = snapshot.firstBeatFrame;
  data[6] = snapshot.playing ? 1 : 0;
  Atomics.add(seq, 0, 1);
}

export function readSyncSnapshot(
  buffer: SharedArrayBuffer,
  attempts = 4,
): SyncSharedSnapshot | null {
  const seq = new Int32Array(buffer, 0, 1);
  const data = new Float64Array(buffer, 8, 7);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const before = Atomics.load(seq, 0);
    if (before & 1) continue;
    const snapshot: SyncSharedSnapshot = {
      outputFrame: data[0]!,
      sourceFrame: data[1]!,
      effectiveRate: data[2]!,
      sourceSampleRate: data[3]!,
      bpm: data[4]!,
      firstBeatFrame: data[5]!,
      playing: data[6] === 1,
    };
    const after = Atomics.load(seq, 0);
    if (before === after && !(after & 1)) return snapshot;
  }

  return null;
}
