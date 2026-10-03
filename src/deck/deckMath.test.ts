import { describe, expect, it } from 'vitest';
import { advanceSourceFrame, clampSourceFrame, linearSample } from './deckMath';

describe('Deck A source-frame math', () => {
  it('clamps seeks without wrapping or silently changing domain', () => {
    expect(clampSourceFrame(-12, 1000)).toBe(0);
    expect(clampSourceFrame(500, 1000)).toBe(500);
    expect(clampSourceFrame(1200, 1000)).toBe(1000);
  });

  it('is invariant to output-block partitioning', () => {
    const totalFrames = 1_000_000;
    const rate = 1.375;
    const oneBlock = advanceSourceFrame(0, 48_000, rate, totalFrames);

    let partitioned = 0;
    for (const size of [64, 192, 128, 1024, 4096, 42560]) {
      partitioned = advanceSourceFrame(partitioned, size, rate, totalFrames);
    }

    expect(partitioned).toBeCloseTo(oneBlock, 9);
  });

  it('linearly interpolates fractional source positions', () => {
    const channel = new Float32Array([0, 1, 0, -1]);
    expect(linearSample(channel, 0.5)).toBeCloseTo(0.5, 7);
    expect(linearSample(channel, 1.5)).toBeCloseTo(0.5, 7);
    expect(linearSample(channel, 2.5)).toBeCloseTo(-0.5, 7);
  });

  it('survives a long deterministic transport simulation without accumulated arithmetic drift', () => {
    const rate = 1.01375;
    const frameCount = 100_000_000;
    let position = 1234.5;
    let totalOutputFrames = 0;

    for (let i = 0; i < 20_000; i += 1) {
      const block = i % 3 === 0 ? 64 : i % 3 === 1 ? 128 : 192;
      position = advanceSourceFrame(position, block, rate, frameCount);
      totalOutputFrames += block;
    }

    expect(position).toBeCloseTo(1234.5 + totalOutputFrames * rate, 6);
  });
});
