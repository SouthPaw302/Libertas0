import { describe, expect, it } from 'vitest';
import {
  analyzeMonoPcm,
  estimateBeatAnchor,
  estimateTempoFromOnsets,
} from './TrackAnalysisCore';

function syntheticClicks(sampleRate: number, bpm: number, seconds: number, offsetSeconds = 0.25): Float32Array {
  const samples = new Float32Array(Math.ceil(sampleRate * seconds));
  const period = sampleRate * 60 / bpm;
  const clickFrames = Math.max(24, Math.round(sampleRate * 0.012));
  for (let position = offsetSeconds * sampleRate; position < samples.length; position += period) {
    const start = Math.round(position);
    for (let i = 0; i < clickFrames && start + i < samples.length; i += 1) {
      const envelope = Math.exp(-8 * i / clickFrames);
      samples[start + i] += 0.75 * envelope * Math.sin(2 * Math.PI * 1400 * i / sampleRate);
    }
  }
  return samples;
}

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

  it('the Phase 9 v2 ensemble uses spectral-comb tempo evidence on PCM', () => {
    const result = analyzeMonoPcm(syntheticClicks(48_000, 128, 24, 0.37), 48_000);
    expect(result.provider).toBe('libertas.rhythm-ensemble.v2');
    expect(result.bpm).toBeCloseTo(128, 0);
    expect(result.firstBeatFrame / 48_000).toBeCloseTo(0.37, 1);
    expect(result.tempoConfidence).toBeGreaterThan(0.35);
    expect(result.gridConfidence).toBeGreaterThan(0.45);
    expect(result.recommended).toBe(true);
    expect(result.diagnostics.tempoCandidates.length).toBeGreaterThan(1);
    expect(result.diagnostics.spectralCombBpm).toBeCloseTo(128, 0);
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
