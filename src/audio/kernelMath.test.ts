import { describe, expect, it } from 'vitest';
import { renderToneBlock, toneSampleAtFrame } from './kernelMath';

describe('audio kernel absolute-frame signal', () => {
  it('is deterministic at a given source frame', () => {
    expect(toneSampleAtFrame(12_345, 48_000, 440, 0.25))
      .toBeCloseTo(toneSampleAtFrame(12_345, 48_000, 440, 0.25), 12);
  });

  it('remains continuous across arbitrary render quantum sizes', () => {
    const sampleRate = 48_000;
    const frequency = 997;
    const gain = 0.2;
    const whole = renderToneBlock(0, 512, sampleRate, frequency, gain);

    const sizes = [64, 192, 128, 128];
    let offset = 0;
    const rebuilt = new Float32Array(512);

    for (const size of sizes) {
      rebuilt.set(renderToneBlock(offset, size, sampleRate, frequency, gain), offset);
      offset += size;
    }

    expect(Array.from(rebuilt)).toEqual(Array.from(whole));
  });

  it('rejects invalid timing inputs instead of silently repairing them', () => {
    expect(() => toneSampleAtFrame(-1, 48_000, 440, 1)).toThrow();
    expect(() => toneSampleAtFrame(0, 0, 440, 1)).toThrow();
    expect(() => renderToneBlock(0, -1, 48_000, 440, 1)).toThrow();
  });
});
