import { describe, expect, it } from 'vitest';
import {
  beatFramesInRange,
  buildWaveformEnvelope,
  detailFrameRange,
  frameToX,
  markerFrames,
} from './WaveformData';

describe('waveform envelope', () => {
  it('builds deterministic min/max peaks', () => {
    const left = Float32Array.from([0, 0.5, -0.5, 1, -1, 0.25, -0.25, 0]);
    const result = buildWaveformEnvelope([left], 8, 48_000, 4);
    expect([...result.min]).toEqual([0, -0.5, -1, -0.25]);
    expect([...result.max]).toEqual([0.5, 1, 0.25, 0]);
  });
});

describe('waveform coordinate helpers', () => {
  it('keeps detail range centered and bounded', () => {
    expect(detailFrameRange(240_000, 480_000, 48_000, 4)).toEqual({ startFrame: 144_000, endFrame: 336_000 });
    expect(detailFrameRange(5, 480_000, 48_000, 4)).toEqual({ startFrame: 0, endFrame: 192_000 });
  });

  it('maps frames to pixels without changing source state', () => {
    expect(frameToX(50, { startFrame: 0, endFrame: 100 }, 1000)).toBe(500);
  });

  it('derives beat lines from the musical grid', () => {
    const frames = beatFramesInRange(
      { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4 },
      48_000,
      { startFrame: 0, endFrame: 96_000 },
    );
    expect(frames).toEqual([0, 24_000, 48_000, 72_000, 96_000]);
  });

  it('extracts cue, hotcue and loop markers', () => {
    expect(markerFrames({
      cueFrame: 100,
      hotCues: [200, null, 400],
      loopStartFrame: 500,
      loopEndFrame: 900,
      loopEnabled: true,
    })).toEqual({
      cueFrame: 100,
      hotCueFrames: [200, 400],
      loopStartFrame: 500,
      loopEndFrame: 900,
      loopEnabled: true,
    });
  });
});
