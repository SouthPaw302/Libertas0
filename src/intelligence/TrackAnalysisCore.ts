export interface TrackAnalysisOptions {
  minBpm?: number;
  maxBpm?: number;
  envelopeRateHz?: number;
}

export interface TrackAnalysisResult {
  provider: 'libertas.onset-autocorrelation.v1';
  execution: 'web-worker';
  sampleRate: number;
  frameCount: number;
  durationSeconds: number;
  bpm: number;
  tempoConfidence: number;
  firstBeatFrame: number;
  phaseConfidence: number;
  gridConfidence: number;
  recommended: boolean;
  beatsPerBar: 4;
  beatUnit: 4;
  descriptors: {
    rms: number;
    peak: number;
    crestFactor: number;
    zeroCrossingRate: number;
  };
  diagnostics: {
    envelopeRateHz: number;
    hopFrames: number;
    tempoLag: number;
    onsetCount: number;
  };
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function computeOnsetEnvelope(
  samples: Float32Array,
  sampleRate: number,
  envelopeRateHz = 400,
): { onset: Float64Array; hopFrames: number; actualEnvelopeRateHz: number } {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new RangeError('sampleRate must be positive');
  const hopFrames = Math.max(32, Math.round(sampleRate / envelopeRateHz));
  const count = Math.max(1, Math.ceil(samples.length / hopFrames));
  const compressed = new Float64Array(count);

  for (let i = 0; i < count; i += 1) {
    const start = i * hopFrames;
    const end = Math.min(samples.length, start + hopFrames);
    let sumSquares = 0;
    for (let j = start; j < end; j += 1) {
      const value = samples[j] ?? 0;
      sumSquares += value * value;
    }
    const rms = end > start ? Math.sqrt(sumSquares / (end - start)) : 0;
    compressed[i] = Math.log1p(50 * rms);
  }

  const onset = new Float64Array(count);
  for (let i = 1; i < count; i += 1) {
    onset[i] = Math.max(0, compressed[i] - compressed[i - 1]);
  }

  return {
    onset,
    hopFrames,
    actualEnvelopeRateHz: sampleRate / hopFrames,
  };
}

function normalizedCorrelation(values: Float64Array, lag: number): number {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = lag; i < values.length; i += 1) {
    const a = values[i] ?? 0;
    const b = values[i - lag] ?? 0;
    dot += a * b;
    aa += a * a;
    bb += b * b;
  }
  const denominator = Math.sqrt(aa * bb);
  return denominator > 0 ? dot / denominator : 0;
}

export function estimateTempoFromOnsets(
  onset: Float64Array,
  envelopeRateHz: number,
  minBpm = 70,
  maxBpm = 180,
): { bpm: number; confidence: number; lag: number } {
  if (onset.length < 8) throw new Error('insufficient onset data');
  if (!(minBpm > 0 && maxBpm > minBpm)) throw new RangeError('invalid BPM range');

  const minLag = Math.max(2, Math.round((envelopeRateHz * 60) / maxBpm));
  const maxLag = Math.min(
    Math.floor(onset.length / 2),
    Math.round((envelopeRateHz * 60) / minBpm),
  );
  if (maxLag <= minLag) throw new Error('track too short for tempo analysis');

  const correlations = new Map<number, number>();
  const corr = (lag: number): number => {
    const bounded = Math.min(maxLag, Math.max(minLag, lag));
    const cached = correlations.get(bounded);
    if (cached !== undefined) return cached;
    const value = normalizedCorrelation(onset, bounded);
    correlations.set(bounded, value);
    return value;
  };

  let bestLag = minLag;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = corr(lag);
    if (lag * 2 <= maxLag) score += 0.35 * corr(lag * 2);
    const half = Math.round(lag / 2);
    if (half >= minLag) score -= 0.15 * corr(half);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y1 = corr(bestLag - 1);
    const y2 = corr(bestLag);
    const y3 = corr(bestLag + 1);
    const denominator = y1 - 2 * y2 + y3;
    if (Math.abs(denominator) > 1e-12) {
      const offset = 0.5 * (y1 - y3) / denominator;
      if (Math.abs(offset) <= 1) refinedLag += offset;
    }
  }

  const peakCorrelation = corr(bestLag);
  const confidence = clamp01((peakCorrelation - 0.2) / 0.7);
  return {
    bpm: (60 * envelopeRateHz) / refinedLag,
    confidence,
    lag: refinedLag,
  };
}

function interpolate(values: Float64Array, position: number): number {
  if (position < 0 || position >= values.length - 1) return 0;
  const left = Math.floor(position);
  const fraction = position - left;
  return (values[left] ?? 0) * (1 - fraction) + (values[left + 1] ?? 0) * fraction;
}

export function estimateBeatAnchor(
  onset: Float64Array,
  periodHops: number,
  hopFrames: number,
): { firstBeatFrame: number; confidence: number } {
  const phaseBins = Math.max(2, Math.round(periodHops));
  const scores = new Float64Array(phaseBins);
  const beatsForPhase = 16;

  let bestPhase = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  let scoreSum = 0;

  for (let phase = 0; phase < phaseBins; phase += 1) {
    let position = phase;
    let score = 0;
    for (let beat = 0; beat < beatsForPhase && position < onset.length; beat += 1) {
      score += interpolate(onset, position);
      position += periodHops;
    }
    scores[phase] = score;
    scoreSum += score;
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  let maxOnset = 0;
  for (const value of onset) maxOnset = Math.max(maxOnset, value);

  let firstIndex = bestPhase;
  const threshold = maxOnset * 0.15;
  for (let index = 0; index < onset.length; index += 1) {
    const value = onset[index] ?? 0;
    if (value < threshold) continue;
    const wrapped = ((index - bestPhase + periodHops / 2) % periodHops + periodHops) % periodHops - periodHops / 2;
    if (Math.abs(wrapped) <= 4) {
      firstIndex = index;
      break;
    }
  }

  const meanScore = scoreSum / phaseBins;
  const separation = bestScore > 0 ? (bestScore - meanScore) / bestScore : 0;
  return {
    firstBeatFrame: Math.round(firstIndex * hopFrames),
    confidence: clamp01(separation),
  };
}

function computeDescriptors(samples: Float32Array): TrackAnalysisResult['descriptors'] {
  let sumSquares = 0;
  let peak = 0;
  let crossings = 0;
  let previous = samples[0] ?? 0;

  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i] ?? 0;
    sumSquares += value * value;
    peak = Math.max(peak, Math.abs(value));
    if (i > 0 && ((value >= 0 && previous < 0) || (value < 0 && previous >= 0))) crossings += 1;
    previous = value;
  }

  const rms = samples.length > 0 ? Math.sqrt(sumSquares / samples.length) : 0;
  return {
    rms,
    peak,
    crestFactor: rms > 0 ? peak / rms : 0,
    zeroCrossingRate: samples.length > 1 ? crossings / (samples.length - 1) : 0,
  };
}

export function analyzeMonoPcm(
  samples: Float32Array,
  sampleRate: number,
  options: TrackAnalysisOptions = {},
): Omit<TrackAnalysisResult, 'execution'> {
  if (samples.length < sampleRate * 4) {
    throw new Error('track intelligence requires at least four seconds of PCM');
  }

  const minBpm = options.minBpm ?? 70;
  const maxBpm = options.maxBpm ?? 180;
  const { onset, hopFrames, actualEnvelopeRateHz } = computeOnsetEnvelope(
    samples,
    sampleRate,
    options.envelopeRateHz ?? 400,
  );
  const tempo = estimateTempoFromOnsets(onset, actualEnvelopeRateHz, minBpm, maxBpm);
  const periodHops = (actualEnvelopeRateHz * 60) / tempo.bpm;
  const phase = estimateBeatAnchor(onset, periodHops, hopFrames);
  const gridConfidence = Math.sqrt(tempo.confidence * phase.confidence);

  return {
    provider: 'libertas.onset-autocorrelation.v1',
    sampleRate,
    frameCount: samples.length,
    durationSeconds: samples.length / sampleRate,
    bpm: tempo.bpm,
    tempoConfidence: tempo.confidence,
    firstBeatFrame: Math.min(samples.length - 1, Math.max(0, phase.firstBeatFrame)),
    phaseConfidence: phase.confidence,
    gridConfidence,
    recommended: gridConfidence >= 0.45,
    beatsPerBar: 4,
    beatUnit: 4,
    descriptors: computeDescriptors(samples),
    diagnostics: {
      envelopeRateHz: actualEnvelopeRateHz,
      hopFrames,
      tempoLag: tempo.lag,
      onsetCount: onset.length,
    },
  };
}
