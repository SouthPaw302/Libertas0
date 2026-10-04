import { describe, expect, it } from 'vitest';
import {
  dbToLinear,
  djFilterFrequencies,
  equalPowerCrossfader,
} from './MixerDspMath';

describe('Mixer DSP math', () => {
  it('maps dB to linear gain', () => {
    expect(dbToLinear(0)).toBe(1);
    expect(dbToLinear(6)).toBeCloseTo(1.995262, 5);
    expect(dbToLinear(-6)).toBeCloseTo(0.501187, 5);
  });

  it('uses an equal-power crossfader law', () => {
    expect(equalPowerCrossfader(-1)).toEqual({ a: 1, b: 0 });
    expect(equalPowerCrossfader(1).a).toBeCloseTo(0, 12);
    expect(equalPowerCrossfader(1).b).toBeCloseTo(1, 12);
    const center = equalPowerCrossfader(0);
    expect(center.a).toBeCloseTo(Math.SQRT1_2, 12);
    expect(center.b).toBeCloseTo(Math.SQRT1_2, 12);
    expect(center.a ** 2 + center.b ** 2).toBeCloseTo(1, 12);
  });

  it('maps negative filter positions to progressively lower low-pass cutoff', () => {
    const center = djFilterFrequencies(0, 48_000);
    const half = djFilterFrequencies(-0.5, 48_000);
    const full = djFilterFrequencies(-1, 48_000);
    expect(half.lowpassHz).toBeLessThan(center.lowpassHz);
    expect(full.lowpassHz).toBeCloseTo(80, 8);
    expect(full.highpassHz).toBe(20);
  });

  it('maps positive filter positions to progressively higher high-pass cutoff', () => {
    const center = djFilterFrequencies(0, 48_000);
    const half = djFilterFrequencies(0.5, 48_000);
    const full = djFilterFrequencies(1, 48_000);
    expect(half.highpassHz).toBeGreaterThan(center.highpassHz);
    expect(full.highpassHz).toBeCloseTo(12_000, 8);
    expect(full.lowpassHz).toBeCloseTo(20_000, 8);
  });

  it('adapts neutral low-pass ceiling to runtime sample rate', () => {
    expect(djFilterFrequencies(0, 44_100).lowpassHz).toBeCloseTo(19_845, 8);
  });

  it('rejects out-of-range crossfader and filter controls', () => {
    expect(() => equalPowerCrossfader(1.01)).toThrow();
    expect(() => djFilterFrequencies(-1.01, 48_000)).toThrow();
  });
});
