import { describe, expect, it } from 'vitest';
import {
  clampTransportFrame,
  jogTargetFrame,
  normalizeLoopRange,
  wrapLoopFrame,
} from './PerformanceTransportMath';

describe('Performance transport math', () => {
  it('clamps explicit cue/hotcue/jog targets to PCM boundaries', () => {
    expect(clampTransportFrame(-10, 1000)).toBe(0);
    expect(clampTransportFrame(500, 1000)).toBe(500);
    expect(clampTransportFrame(1500, 1000)).toBe(1000);
    expect(jogTargetFrame(100, -250, 1000)).toBe(0);
    expect(jogTargetFrame(900, 250, 1000)).toBe(1000);
  });

  it('rejects zero/negative loops', () => {
    expect(() => normalizeLoopRange(100, 100, 1000)).toThrow();
    expect(() => normalizeLoopRange(200, 100, 1000)).toThrow();
  });

  it('preserves overshoot when wrapping loop boundaries', () => {
    const loop = normalizeLoopRange(100, 200, 1000);
    expect(wrapLoopFrame(200, loop)).toBe(100);
    expect(wrapLoopFrame(225, loop)).toBe(125);
    expect(wrapLoopFrame(475, loop)).toBe(175);
  });

  it('is independent of render-block partitioning', () => {
    const loop = { startFrame: 10_000, endFrame: 13_000 };
    const rate = 1.25;
    let a = 12_900;
    let b = 12_900;

    a = wrapLoopFrame(a + 4096 * rate, loop);
    for (const block of [128, 256, 512, 1024, 2176]) {
      b = wrapLoopFrame(b + block * rate, loop);
    }

    expect(b).toBeCloseTo(a, 10);
  });
});
