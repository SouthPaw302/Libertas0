import { describe, expect, it } from 'vitest';
import {
  MusicalClock,
  beatPositionToSourceFrame,
  framesPerBeat,
  quantizeSourceFrame,
  sourceFrameToMusicalPosition,
} from './MusicalClock';

describe('MusicalClock', () => {
  const sampleRate = 48_000;
  const grid = { bpm: 120, firstBeatFrame: 24_000, beatsPerBar: 4, beatUnit: 4 };

  it('maps source frames and beats exactly in both directions', () => {
    expect(framesPerBeat(sampleRate, grid.bpm)).toBe(24_000);
    expect(beatPositionToSourceFrame(0, sampleRate, grid)).toBe(24_000);
    expect(beatPositionToSourceFrame(4, sampleRate, grid)).toBe(120_000);

    const pos = sourceFrameToMusicalPosition(120_000, sampleRate, grid);
    expect(pos.beatPosition).toBe(4);
    expect(pos.beatIndex).toBe(4);
    expect(pos.barIndex).toBe(1);
    expect(pos.beatInBar).toBe(0);
    expect(pos.beatPhase).toBe(0);
  });

  it('preserves correct phase and bar semantics before the first beat', () => {
    const pos = sourceFrameToMusicalPosition(12_000, sampleRate, grid);
    expect(pos.beatPosition).toBe(-0.5);
    expect(pos.beatIndex).toBe(-1);
    expect(pos.beatInBar).toBe(3);
    expect(pos.barIndex).toBe(-1);
    expect(pos.beatPhase).toBeCloseTo(0.5, 12);
    expect(pos.barPhase).toBeCloseTo(0.875, 12);
  });

  it('quantizes deterministically to previous, nearest and next beat', () => {
    const source = beatPositionToSourceFrame(2.4, sampleRate, grid);
    expect(quantizeSourceFrame(source, sampleRate, grid, 1, 'previous'))
      .toBe(beatPositionToSourceFrame(2, sampleRate, grid));
    expect(quantizeSourceFrame(source, sampleRate, grid, 1, 'nearest'))
      .toBe(beatPositionToSourceFrame(2, sampleRate, grid));
    expect(quantizeSourceFrame(source, sampleRate, grid, 1, 'next'))
      .toBe(beatPositionToSourceFrame(3, sampleRate, grid));
  });

  it('supports fractional beat quanta without accumulating timeline drift', () => {
    const clock = new MusicalClock(sampleRate, grid);
    let maxError = 0;

    for (let beat = -128; beat <= 2048; beat += 0.25) {
      const frame = clock.sourceFrameAtBeat(beat);
      const roundTrip = clock.positionAt(frame).beatPosition;
      maxError = Math.max(maxError, Math.abs(roundTrip - beat));
    }

    expect(maxError).toBeLessThan(1e-12);
  });

  it('keeps separate grids independent', () => {
    const a = new MusicalClock(48_000, { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 });
    const b = new MusicalClock(48_000, { bpm: 90, firstBeatFrame: 12_000, beatsPerBar: 3, beatUnit: 4 });

    expect(a.positionAt(96_000).beatPosition).toBe(4);
    expect(b.positionAt(96_000).beatPosition).toBeCloseTo(2.625, 12);

    a.setGrid({ bpm: 100, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 });
    expect(b.positionAt(96_000).beatPosition).toBeCloseTo(2.625, 12);
  });

  it('rejects invalid grid definitions instead of silently repairing them', () => {
    expect(() => new MusicalClock(48_000, { bpm: 0, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 })).toThrow();
    expect(() => new MusicalClock(48_000, { bpm: 120, firstBeatFrame: 0, beatsPerBar: 0, beatUnit: 4 })).toThrow();
    expect(() => new MusicalClock(48_000, { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 3 })).toThrow();
  });
});
