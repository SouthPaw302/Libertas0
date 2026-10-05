import { describe, expect, it } from 'vitest';
import {
  beatDelaySeconds,
  effectiveTempoBpm,
  equalPowerDryWet,
  fxToneFrequency,
} from './FxMath';

describe('FX math', () => {
  it('uses equal-power dry/wet law', () => {
    expect(equalPowerDryWet(0)).toEqual({ dryGain: 1, wetGain: 0 });
    const middle = equalPowerDryWet(0.5);
    expect(middle.dryGain).toBeCloseTo(Math.SQRT1_2, 10);
    expect(middle.wetGain).toBeCloseTo(Math.SQRT1_2, 10);
    expect(equalPowerDryWet(1).wetGain).toBeCloseTo(1, 10);
  });

  it('derives delay time from beat duration', () => {
    expect(beatDelaySeconds(120, 1)).toBeCloseTo(0.5, 10);
    expect(beatDelaySeconds(120, 0.5)).toBeCloseTo(0.25, 10);
    expect(beatDelaySeconds(60, 8, 4)).toBe(4);
  });

  it('derives effective tempo from the musical grid and playback rate', () => {
    expect(effectiveTempoBpm(125, 1)).toBe(125);
    expect(effectiveTempoBpm(125, 1.04)).toBeCloseTo(130, 10);
  });

  it('maps FX tone logarithmically', () => {
    expect(fxToneFrequency(0)).toBe(800);
    expect(fxToneFrequency(1)).toBeCloseTo(18_000, 5);
    expect(fxToneFrequency(0.5)).toBeGreaterThan(3_000);
  });
});
