import { describe, expect, it } from 'vitest';
import { createSyncSharedBuffer, readSyncSnapshot, writeSyncSnapshot } from './SharedSyncBus';

describe('SharedSyncBus', () => {
  it('round-trips an atomic leader snapshot', () => {
    const buffer = createSyncSharedBuffer();
    writeSyncSnapshot(buffer, {
      outputFrame: 123456,
      sourceFrame: 65432.25,
      effectiveRate: 0.9375,
      sourceSampleRate: 48_000,
      bpm: 120,
      firstBeatFrame: 2400,
      playing: true,
    });

    expect(readSyncSnapshot(buffer)).toEqual({
      outputFrame: 123456,
      sourceFrame: 65432.25,
      effectiveRate: 0.9375,
      sourceSampleRate: 48_000,
      bpm: 120,
      firstBeatFrame: 2400,
      playing: true,
    });
  });
});
