import { describe, expect, it } from 'vitest';
import { quantizedSamplerStart } from './SamplerTiming';

const grid = {
  bpm: 120,
  firstBeatFrame: 0,
  beatsPerBar: 4,
  beatUnit: 4,
};

describe('quantizedSamplerStart', () => {
  it('maps the next musical boundary onto the AudioContext frame timeline', () => {
    const result = quantizedSamplerStart({
      sourceFrame: 12_000,
      outputCurrentFrame: 96_000,
      sampleRate: 48_000,
      sourceSampleRate: 48_000,
      playbackRate: 1,
      playing: true,
    }, grid, 1, 2.0, 0.01);

    expect(result.targetSourceFrame).toBe(24_000);
    expect(result.scheduledContextTime).toBeCloseTo(2.25, 8);
  });

  it('accounts for deck playback rate', () => {
    const result = quantizedSamplerStart({
      sourceFrame: 12_000,
      outputCurrentFrame: 96_000,
      sampleRate: 48_000,
      sourceSampleRate: 48_000,
      playbackRate: 2,
      playing: true,
    }, grid, 1, 2.0, 0.01);

    expect(result.scheduledContextTime).toBeCloseTo(2.125, 8);
  });

  it('advances a boundary when scheduling lead time would be missed', () => {
    const result = quantizedSamplerStart({
      sourceFrame: 23_990,
      outputCurrentFrame: 96_000,
      sampleRate: 48_000,
      sourceSampleRate: 48_000,
      playbackRate: 1,
      playing: true,
    }, grid, 1, 2.0, 0.03);

    expect(result.targetSourceFrame).toBe(48_000);
    expect(result.scheduledContextTime).toBeGreaterThan(2.03);
  });

  it('rejects quantization against a stopped deck', () => {
    expect(() => quantizedSamplerStart({
      sourceFrame: 0,
      outputCurrentFrame: 0,
      sampleRate: 48_000,
      sourceSampleRate: 48_000,
      playbackRate: 1,
      playing: false,
    }, grid, 1, 0)).toThrow(/playing source deck/);
  });
});
