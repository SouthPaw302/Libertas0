export function toneSampleAtFrame(
  frame: number,
  sampleRate: number,
  frequencyHz: number,
  gain: number,
): number {
  if (!Number.isFinite(frame) || frame < 0) throw new RangeError('frame must be a non-negative finite number');
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new RangeError('sampleRate must be positive');
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) throw new RangeError('frequencyHz must be positive');
  if (!Number.isFinite(gain)) throw new RangeError('gain must be finite');

  return Math.sin((2 * Math.PI * frequencyHz * frame) / sampleRate) * gain;
}

export function renderToneBlock(
  startFrame: number,
  frameCount: number,
  sampleRate: number,
  frequencyHz: number,
  gain: number,
): Float32Array {
  if (!Number.isInteger(frameCount) || frameCount < 0) {
    throw new RangeError('frameCount must be a non-negative integer');
  }

  const output = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i += 1) {
    output[i] = toneSampleAtFrame(startFrame + i, sampleRate, frequencyHz, gain);
  }
  return output;
}
