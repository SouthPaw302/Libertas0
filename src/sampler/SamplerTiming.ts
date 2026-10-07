import {
  framesPerBeat,
  quantizeSourceFrame,
  type BeatGrid,
} from '../music/MusicalClock';

export interface SamplerQuantizeReference {
  sourceFrame: number;
  outputCurrentFrame: number;
  sampleRate: number;
  sourceSampleRate: number;
  playbackRate: number;
  playing: boolean;
}

export interface QuantizedSamplerStart {
  targetSourceFrame: number;
  scheduledContextTime: number;
  quantumBeats: number;
}

export function quantizedSamplerStart(
  reference: SamplerQuantizeReference,
  grid: BeatGrid,
  quantumBeats: number,
  contextCurrentTime: number,
  minimumLeadSeconds = 0.03,
): QuantizedSamplerStart {
  if (!reference.playing) {
    throw new Error('quantized sampler triggering requires a playing source deck');
  }
  if (!Number.isFinite(reference.playbackRate) || reference.playbackRate <= 0) {
    throw new RangeError('playback rate must be positive');
  }
  if (!Number.isFinite(quantumBeats) || quantumBeats <= 0) {
    throw new RangeError('quantum beats must be positive');
  }
  if (!Number.isFinite(contextCurrentTime) || contextCurrentTime < 0) {
    throw new RangeError('context current time must be non-negative');
  }

  const sourceRate = reference.sourceSampleRate > 0
    ? reference.sourceSampleRate
    : reference.sampleRate;
  const stepFrames = framesPerBeat(sourceRate, grid.bpm) * quantumBeats;
  let targetSourceFrame = quantizeSourceFrame(
    reference.sourceFrame,
    sourceRate,
    grid,
    quantumBeats,
    'next',
  );

  const targetTime = (frame: number): number => {
    const sourceDelta = frame - reference.sourceFrame;
    const outputDeltaFrames = sourceDelta / reference.playbackRate;
    return (reference.outputCurrentFrame + outputDeltaFrames) / reference.sampleRate;
  };

  const minimumTime = contextCurrentTime + Math.max(0, minimumLeadSeconds);
  let scheduledContextTime = targetTime(targetSourceFrame);
  while (scheduledContextTime < minimumTime) {
    targetSourceFrame += stepFrames;
    scheduledContextTime = targetTime(targetSourceFrame);
  }

  return {
    targetSourceFrame,
    scheduledContextTime,
    quantumBeats,
  };
}
