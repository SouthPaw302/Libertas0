import { describe, expect, it } from 'vitest';
import { cueNormalization, monitorBlendGains } from './MonitorCueMath';

describe('monitorBlendGains', () => {
  it('uses equal-power cue/master blending', () => {
    expect(monitorBlendGains(0)).toEqual({ cueGain: 1, masterGain: 0 });
    const center = monitorBlendGains(0.5);
    expect(center.cueGain).toBeCloseTo(Math.SQRT1_2, 10);
    expect(center.masterGain).toBeCloseTo(Math.SQRT1_2, 10);
    expect(monitorBlendGains(1).masterGain).toBeCloseTo(1, 10);
  });

  it('rejects invalid positions', () => {
    expect(() => monitorBlendGains(-0.01)).toThrow(RangeError);
    expect(() => monitorBlendGains(1.01)).toThrow(RangeError);
  });
});

describe('cueNormalization', () => {
  it('normalizes a two-deck cue sum', () => {
    expect(cueNormalization(0)).toBe(1);
    expect(cueNormalization(1)).toBe(1);
    expect(cueNormalization(2)).toBeCloseTo(Math.SQRT1_2, 10);
  });
});
