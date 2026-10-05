export interface WaveformEnvelope {
  sourceFrames: number;
  sampleRate: number;
  buckets: number;
  min: Float32Array;
  max: Float32Array;
}

export interface FrameRange {
  startFrame: number;
  endFrame: number;
}

export interface WaveformMarkers {
  cueFrame: number | null;
  hotCueFrames: number[];
  loopStartFrame: number | null;
  loopEndFrame: number | null;
  loopEnabled: boolean;
}

export interface BeatGridLike {
  bpm: number;
  firstBeatFrame: number;
  beatsPerBar?: number;
}

export function buildWaveformEnvelope(
  channels: Float32Array[],
  sourceFrames: number,
  sampleRate: number,
  buckets = 2048,
): WaveformEnvelope {
  if (!Number.isFinite(sourceFrames) || sourceFrames < 0) throw new RangeError('sourceFrames must be non-negative');
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new RangeError('sampleRate must be positive');
  if (!Number.isInteger(buckets) || buckets < 1) throw new RangeError('buckets must be a positive integer');

  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  if (sourceFrames === 0 || channels.length === 0) {
    return { sourceFrames, sampleRate, buckets, min, max };
  }

  const framesPerBucket = sourceFrames / buckets;
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor(bucket * framesPerBucket);
    const end = Math.min(sourceFrames, Math.max(start + 1, Math.ceil((bucket + 1) * framesPerBucket)));
    let bucketMin = 1;
    let bucketMax = -1;

    for (let frame = start; frame < end; frame += 1) {
      for (const channel of channels) {
        const sample = channel[frame] ?? 0;
        if (sample < bucketMin) bucketMin = sample;
        if (sample > bucketMax) bucketMax = sample;
      }
    }

    min[bucket] = bucketMin === 1 ? 0 : bucketMin;
    max[bucket] = bucketMax === -1 ? 0 : bucketMax;
  }

  return { sourceFrames, sampleRate, buckets, min, max };
}

export function detailFrameRange(
  sourceFrame: number,
  sourceFrames: number,
  sampleRate: number,
  windowSeconds = 12,
): FrameRange {
  if (!Number.isFinite(sourceFrame) || !Number.isFinite(sourceFrames) || !Number.isFinite(sampleRate)) {
    throw new RangeError('waveform frame values must be finite');
  }
  const total = Math.max(0, sourceFrames);
  const windowFrames = Math.max(1, sampleRate * Math.max(0.25, windowSeconds));
  if (total <= windowFrames) return { startFrame: 0, endFrame: total };

  const half = windowFrames / 2;
  let start = sourceFrame - half;
  start = Math.max(0, Math.min(start, total - windowFrames));
  return { startFrame: start, endFrame: start + windowFrames };
}

export function frameToX(frame: number, range: FrameRange, width: number): number {
  const span = range.endFrame - range.startFrame;
  if (span <= 0 || width <= 0) return 0;
  return ((frame - range.startFrame) / span) * width;
}

export function beatFramesInRange(
  grid: BeatGridLike,
  sampleRate: number,
  range: FrameRange,
  maxLines = 512,
): number[] {
  if (!Number.isFinite(grid.bpm) || grid.bpm <= 0 || sampleRate <= 0) return [];
  const framesPerBeat = (sampleRate * 60) / grid.bpm;
  const firstIndex = Math.ceil((range.startFrame - grid.firstBeatFrame) / framesPerBeat);
  const lastIndex = Math.floor((range.endFrame - grid.firstBeatFrame) / framesPerBeat);
  const output: number[] = [];

  for (let i = firstIndex; i <= lastIndex && output.length < maxLines; i += 1) {
    output.push(grid.firstBeatFrame + i * framesPerBeat);
  }
  return output;
}

export function markerFrames(status: {
  cueFrame: number | null;
  hotCues: Array<number | null>;
  loopStartFrame: number | null;
  loopEndFrame: number | null;
  loopEnabled: boolean;
}): WaveformMarkers {
  return {
    cueFrame: status.cueFrame,
    hotCueFrames: status.hotCues.filter((frame): frame is number => Number.isFinite(frame)),
    loopStartFrame: status.loopStartFrame,
    loopEndFrame: status.loopEndFrame,
    loopEnabled: status.loopEnabled,
  };
}
