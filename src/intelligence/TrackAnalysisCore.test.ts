import { describe, expect, it } from 'vitest';
import {
  analyzeMonoPcm,
  estimateBeatAnchor,
  estimateTempoFromOnsets,
} from './TrackAnalysisCore';

function syntheticOnsets(rate: number, bpm: number, seconds: number, offsetSeconds = 0.25): Float64Array {
  const values = new Float64Array(Math.ceil(rate * seconds));
  const period = (rate * 60) / bpm;
  for (let position = offsetSeconds * rate; position < values.length; position += period) {
    values[Math.round(position)] = 1;
  }
  return values;
}

describe('Track intelligence core', () => {
  it('estimates tempo across the DJ range without octave collapse', () => {
    for (const bpm of [90, 100, 120, 128, 150, 175]) {
      const result = estimateTempoFromOnsets(syntheticOnsets(400, bpm, 24), 400, 70, 180);
      expect(result.bpm).toBeCloseTo(bpm, 0);
      expect(result.confidence).toBeGreaterThan(0.4);
    }
  });

  it('finds an early beat anchor near the dominant phase', () => {
    const onset = syntheticOnsets(400, 128, 20, 0.37);
    const period = (400 * 60) / 128;
    const anchor = estimateBeatAnchor(onset, period, 120);
    expect(anchor.firstBeatFrame / 48_000).toBeCloseTo(0.37, 2);
    expect(anchor.confidence).toBeGreaterThan(0.5);
  });

  it('rejects tracks too short for useful analysis', () => {
    expect(() => analyzeMonoPcm(new Float32Array(48_000 * 2), 48_000)).toThrow();
  });
});
