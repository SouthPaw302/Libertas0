import { describe, expect, it } from 'vitest';
import { analyzeMonoPcm } from './TrackIntelligenceEngine';

function syntheticClicks(
  sampleRate: number,
  durationSeconds: number,
  bpm: number,
  firstBeatSeconds = 0,
): Float32Array {
  const frames = Math.floor(sampleRate * durationSeconds);
  const samples = new Float32Array(frames);
  const beatFrames = (sampleRate * 60) / bpm;
  const firstBeat = Math.floor(firstBeatSeconds * sampleRate);
  const clickLength = Math.max(8, Math.floor(sampleRate * 0.008));

  for (let beat = firstBeat; beat < frames; beat += beatFrames) {
    const start = Math.round(beat);
    for (let i = 0; i < clickLength && start + i < frames; i += 1) {
      samples[start + i] += Math.sin((2 * Math.PI * 1600 * i) / sampleRate) * Math.exp(-8 * i / clickLength) * 0.8;
    }
  }
  return samples;
}

describe('Track Intelligence reference analyzer', () => {
  it('recovers 120 BPM and a delayed first-beat anchor', () => {
    const sampleRate = 48_000;
    const firstBeatSeconds = 0.35;
    const result = analyzeMonoPcm(
      syntheticClicks(sampleRate, 24, 120, firstBeatSeconds),
      sampleRate,
    );
    expect(result.bpm).toBeCloseTo(120, 0);
    expect(Math.abs(result.beatAnchorFrame - firstBeatSeconds * sampleRate)).toBeLessThan(sampleRate * 0.03);
    expect(result.bpmConfidence).toBeGreaterThan(0.5);
    expect(result.overallConfidence).toBeGreaterThan(0.35);
  });

  it('is sample-rate agnostic at 128 BPM', () => {
    const sampleRate = 44_100;
    const result = analyzeMonoPcm(syntheticClicks(sampleRate, 24, 128, 0.12), sampleRate);
    expect(result.bpm).toBeCloseTo(128, 0);
    expect(Math.abs(result.beatAnchorFrame - 0.12 * sampleRate)).toBeLessThan(sampleRate * 0.04);
    expect(result.sourceSampleRate).toBe(sampleRate);
  });

  it('returns finite energy and spectral descriptors', () => {
    const sampleRate = 48_000;
    const result = analyzeMonoPcm(syntheticClicks(sampleRate, 12, 100), sampleRate);
    expect(result.descriptors.rms).toBeGreaterThan(0);
    expect(result.descriptors.peak).toBeGreaterThan(0.5);
    expect(result.descriptors.crestFactor).toBeGreaterThan(1);
    expect(result.descriptors.zeroCrossingRate).toBeGreaterThan(0);
    expect(result.descriptors.spectralCentroidHz).toBeGreaterThan(500);
    expect(result.descriptors.spectralCentroidHz).toBeLessThan(sampleRate / 2);
  });

  it('fails closed on silence rather than inventing a tempo', () => {
    expect(() => analyzeMonoPcm(new Float32Array(48_000 * 4), 48_000)).toThrow(
      /insufficient transient structure/,
    );
  });
});
