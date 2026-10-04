export interface TrackAnalysisOptions {
  minBpm?: number;
  maxBpm?: number;
  envelopeRateHz?: number;
}

export interface TrackAnalysisResult {
  schema: 'libertas.track-analysis.v1';
  provider: 'libertas.reference-onset-autocorrelation.v1';
  sourceSampleRate: number;
  sourceFrames: number;
  durationSeconds: number;
  bpm: number;
  bpmConfidence: number;
  beatAnchorFrame: number;
  beatAnchorConfidence: number;
  overallConfidence: number;
  gridProposal: {
    bpm: number;
    firstBeatFrame: number;
    beatsPerBar: 4;
    beatUnit: 4;
    status: 'proposal';
  };
  descriptors: {
    rms: number;
    peak: number;
    crestFactor: number;
    zeroCrossingRate: number;
    spectralCentroidHz: number;
  };
  provenance: {
    analysisDomain: 'background-worker';
    onsetMethod: 'rms-flux+derivative-flux';
    tempoMethod: 'normalized-autocorrelation';
    beatAnchorMethod: 'periodic-onset-phase';
    minBpm: number;
    maxBpm: number;
    hopFrames: number;
    envelopeRateHz: number;
  };
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

function validatePcm(samples: Float32Array, sampleRate: number): void {
  if (!(samples instanceof Float32Array) || samples.length < 2048) {
    throw new RangeError('analysis requires at least 2048 mono PCM frames');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('sampleRate must be positive');
  }
}

function buildOnsetEnvelope(
  samples: Float32Array,
  sampleRate: number,
  targetRateHz: number,
): { onset: Float64Array; hopFrames: number; envelopeRateHz: number } {
  const hopFrames = Math.max(32, Math.round(sampleRate / targetRateHz));
  const count = Math.ceil(samples.length / hopFrames);
  const rms = new Float64Array(count);
  const derivative = new Float64Array(count);

  let previousSample = samples[0] ?? 0;
  for (let block = 0; block < count; block += 1) {
    const start = block * hopFrames;
    const end = Math.min(samples.length, start + hopFrames);
    let squares = 0;
    let diff = 0;
    for (let i = start; i < end; i += 1) {
      const sample = samples[i] ?? 0;
      squares += sample * sample;
      diff += Math.abs(sample - previousSample);
      previousSample = sample;
    }
    const length = Math.max(1, end - start);
    rms[block] = Math.sqrt(squares / length);
    derivative[block] = diff / length;
  }

  const onset = new Float64Array(count);
  let max = 0;
  for (let i = 0; i < count; i += 1) {
    const previousRms = i > 0 ? rms[i - 1]! : 0;
    const previousDerivative = i > 0 ? derivative[i - 1]! : 0;
    const rmsFlux = Math.max(0, rms[i]! - previousRms);
    const derivativeFlux = Math.max(0, derivative[i]! - previousDerivative);
    const value = rmsFlux + 0.5 * derivativeFlux;
    onset[i] = value;
    max = Math.max(max, value);
  }

  if (max <= 1e-8) {
    throw new Error('insufficient transient structure for beat analysis');
  }

  const threshold = max * 0.015;
  for (let i = 0; i < onset.length; i += 1) {
    if (onset[i]! < threshold) onset[i] = 0;
  }

  return {
    onset,
    hopFrames,
    envelopeRateHz: sampleRate / hopFrames,
  };
}

function normalizedAutocorrelation(values: Float64Array, lag: number): number {
  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let i = 0; i + lag < values.length; i += 1) {
    const a = values[i]!;
    const b = values[i + lag]!;
    numerator += a * b;
    leftEnergy += a * a;
    rightEnergy += b * b;
  }
  const denominator = Math.sqrt(leftEnergy * rightEnergy);
  return denominator > 1e-12 ? numerator / denominator : 0;
}

function tempoFromEnvelope(
  onset: Float64Array,
  envelopeRateHz: number,
  minBpm: number,
  maxBpm: number,
): { bpm: number; confidence: number; periodEnvelopeFrames: number } {
  const minLag = Math.max(2, Math.floor((60 * envelopeRateHz) / maxBpm));
  const maxLag = Math.min(onset.length - 2, Math.ceil((60 * envelopeRateHz) / minBpm));
  if (maxLag <= minLag) throw new Error('audio is too short for requested BPM range');

  const scores = new Float64Array(maxLag + 1);
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const score = normalizedAutocorrelation(onset, lag);
    scores[lag] = score;
    if (score > best) best = score;
  }

  if (!Number.isFinite(best) || best < 0.08) {
    throw new Error('tempo confidence is too low');
  }

  let bestLag = minLag;
  const nearBest = best * 0.985;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (scores[lag]! >= nearBest) {
      bestLag = lag;
      break;
    }
  }

  const left = scores[Math.max(minLag, bestLag - 1)]!;
  const center = scores[bestLag]!;
  const right = scores[Math.min(maxLag, bestLag + 1)]!;
  const denominator = left - 2 * center + right;
  const offset = Math.abs(denominator) > 1e-12
    ? Math.min(Math.max(0.5 * (left - right) / denominator, -0.5), 0.5)
    : 0;
  const refinedLag = bestLag + offset;
  const bpm = (60 * envelopeRateHz) / refinedLag;

  return {
    bpm,
    confidence: clamp01(center),
    periodEnvelopeFrames: refinedLag,
  };
}

function sampleLinear(values: Float64Array, position: number): number {
  if (position < 0 || position >= values.length - 1) {
    return values[Math.min(Math.max(Math.round(position), 0), values.length - 1)] ?? 0;
  }
  const left = Math.floor(position);
  const fraction = position - left;
  return values[left]! * (1 - fraction) + values[left + 1]! * fraction;
}

function beatAnchorFromEnvelope(
  onset: Float64Array,
  period: number,
  hopFrames: number,
): { beatAnchorFrame: number; confidence: number } {
  const phaseBins = Math.max(2, Math.round(period));
  let bestPhase = 0;
  let bestScore = -Infinity;
  let maxOnset = 0;
  for (const value of onset) maxOnset = Math.max(maxOnset, value);

  for (let phase = 0; phase < phaseBins; phase += 1) {
    let sum = 0;
    let count = 0;
    for (let position = phase; position < onset.length; position += period) {
      sum += sampleLinear(onset, position);
      count += 1;
    }
    const score = count > 0 ? sum / count : 0;
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  const strongThreshold = maxOnset * 0.18;
  let firstStrong = bestPhase;
  for (let position = bestPhase; position < onset.length; position += period) {
    const rounded = Math.round(position);
    const local = Math.max(
      onset[Math.max(0, rounded - 1)] ?? 0,
      onset[rounded] ?? 0,
      onset[Math.min(onset.length - 1, rounded + 1)] ?? 0,
    );
    if (local >= strongThreshold) {
      firstStrong = position;
      break;
    }
  }

  return {
    beatAnchorFrame: Math.round(firstStrong * hopFrames),
    confidence: clamp01(bestScore / Math.max(maxOnset, 1e-12)),
  };
}

function spectralCentroidHz(samples: Float32Array, sampleRate: number): number {
  const windowSize = 512;
  const bins = windowSize / 2;
  const windows = Math.min(6, Math.max(1, Math.floor(samples.length / windowSize)));
  let weighted = 0;
  let magnitudes = 0;

  for (let w = 0; w < windows; w += 1) {
    const maxStart = Math.max(0, samples.length - windowSize);
    const start = windows === 1 ? 0 : Math.floor((w / (windows - 1)) * maxStart);

    for (let k = 1; k < bins; k += 1) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < windowSize; n += 1) {
        const sample = samples[start + n] ?? 0;
        const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (windowSize - 1));
        const angle = (-2 * Math.PI * k * n) / windowSize;
        const value = sample * hann;
        real += value * Math.cos(angle);
        imag += value * Math.sin(angle);
      }
      const magnitude = Math.hypot(real, imag);
      const frequency = (k * sampleRate) / windowSize;
      weighted += frequency * magnitude;
      magnitudes += magnitude;
    }
  }

  return magnitudes > 1e-12 ? weighted / magnitudes : 0;
}

function descriptors(samples: Float32Array, sampleRate: number): TrackAnalysisResult['descriptors'] {
  let squares = 0;
  let peak = 0;
  let crossings = 0;
  let previous = samples[0] ?? 0;

  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i] ?? 0;
    squares += value * value;
    peak = Math.max(peak, Math.abs(value));
    if (i > 0 && ((value >= 0 && previous < 0) || (value < 0 && previous >= 0))) {
      crossings += 1;
    }
    previous = value;
  }

  const rms = Math.sqrt(squares / samples.length);
  return {
    rms,
    peak,
    crestFactor: rms > 1e-12 ? peak / rms : 0,
    zeroCrossingRate: crossings / Math.max(1, samples.length - 1),
    spectralCentroidHz: spectralCentroidHz(samples, sampleRate),
  };
}

export function analyzeMonoPcm(
  samples: Float32Array,
  sampleRate: number,
  options: TrackAnalysisOptions = {},
): TrackAnalysisResult {
  validatePcm(samples, sampleRate);

  const minBpm = options.minBpm ?? 70;
  const maxBpm = options.maxBpm ?? 190;
  const envelopeRateTarget = options.envelopeRateHz ?? 200;
  if (!(minBpm > 0 && maxBpm > minBpm)) {
    throw new RangeError('BPM range is invalid');
  }

  const { onset, hopFrames, envelopeRateHz } = buildOnsetEnvelope(
    samples,
    sampleRate,
    envelopeRateTarget,
  );
  const tempo = tempoFromEnvelope(onset, envelopeRateHz, minBpm, maxBpm);
  const anchor = beatAnchorFromEnvelope(onset, tempo.periodEnvelopeFrames, hopFrames);
  const overallConfidence = Math.sqrt(tempo.confidence * anchor.confidence);

  return {
    schema: 'libertas.track-analysis.v1',
    provider: 'libertas.reference-onset-autocorrelation.v1',
    sourceSampleRate: sampleRate,
    sourceFrames: samples.length,
    durationSeconds: samples.length / sampleRate,
    bpm: tempo.bpm,
    bpmConfidence: tempo.confidence,
    beatAnchorFrame: anchor.beatAnchorFrame,
    beatAnchorConfidence: anchor.confidence,
    overallConfidence,
    gridProposal: {
      bpm: tempo.bpm,
      firstBeatFrame: anchor.beatAnchorFrame,
      beatsPerBar: 4,
      beatUnit: 4,
      status: 'proposal',
    },
    descriptors: descriptors(samples, sampleRate),
    provenance: {
      analysisDomain: 'background-worker',
      onsetMethod: 'rms-flux+derivative-flux',
      tempoMethod: 'normalized-autocorrelation',
      beatAnchorMethod: 'periodic-onset-phase',
      minBpm,
      maxBpm,
      hopFrames,
      envelopeRateHz,
    },
  };
}
