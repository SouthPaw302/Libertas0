export function clampSourceFrame(frame: number, frameCount: number): number {
  if (!Number.isFinite(frame)) throw new RangeError('frame must be finite');
  if (!Number.isInteger(frameCount) || frameCount < 0) {
    throw new RangeError('frameCount must be a non-negative integer');
  }
  return Math.min(Math.max(frame, 0), frameCount);
}

export function advanceSourceFrame(
  sourceFrame: number,
  outputFrames: number,
  playbackRate: number,
  frameCount: number,
): number {
  if (!Number.isFinite(sourceFrame)) throw new RangeError('sourceFrame must be finite');
  if (!Number.isInteger(outputFrames) || outputFrames < 0) {
    throw new RangeError('outputFrames must be a non-negative integer');
  }
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) {
    throw new RangeError('playbackRate must be positive');
  }
  return clampSourceFrame(sourceFrame + outputFrames * playbackRate, frameCount);
}

export function linearSample(channel: Float32Array, sourceFrame: number): number {
  if (channel.length === 0) return 0;
  const position = clampSourceFrame(sourceFrame, channel.length - 1);
  const left = Math.floor(position);
  const right = Math.min(left + 1, channel.length - 1);
  const fraction = position - left;
  return channel[left]! + (channel[right]! - channel[left]!) * fraction;
}
