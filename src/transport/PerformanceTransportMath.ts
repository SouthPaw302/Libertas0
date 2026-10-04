export interface LoopRange {
  startFrame: number;
  endFrame: number;
}

export function clampTransportFrame(frame: number, frameCount: number): number {
  if (!Number.isFinite(frame)) throw new RangeError('frame must be finite');
  if (!Number.isFinite(frameCount) || frameCount < 0) {
    throw new RangeError('frameCount must be non-negative');
  }
  return Math.min(Math.max(frame, 0), frameCount);
}

export function normalizeLoopRange(
  startFrame: number,
  endFrame: number,
  frameCount: number,
): LoopRange {
  const start = clampTransportFrame(startFrame, frameCount);
  const end = clampTransportFrame(endFrame, frameCount);
  if (!(end > start)) throw new RangeError('loop end must be greater than loop start');
  return { startFrame: start, endFrame: end };
}

export function wrapLoopFrame(frame: number, loop: LoopRange): number {
  if (!Number.isFinite(frame)) throw new RangeError('frame must be finite');
  const length = loop.endFrame - loop.startFrame;
  if (!(length > 0)) throw new RangeError('loop length must be positive');
  if (frame < loop.endFrame) return frame;
  return loop.startFrame + ((frame - loop.startFrame) % length);
}

export function jogTargetFrame(
  sourceFrame: number,
  deltaFrames: number,
  frameCount: number,
): number {
  if (!Number.isFinite(deltaFrames)) throw new RangeError('deltaFrames must be finite');
  return clampTransportFrame(sourceFrame + deltaFrames, frameCount);
}
