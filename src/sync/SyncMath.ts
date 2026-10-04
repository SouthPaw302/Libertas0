export interface SyncControlOptions {
  phaseSettleSeconds: number;
  maxPhaseCorrectionRate: number;
  phaseDeadbandBeats: number;
  rateSmoothingSeconds: number;
  lockThresholdBeats: number;
  staleSnapshotSeconds: number;
}

export const DEFAULT_SYNC_OPTIONS: SyncControlOptions = {
  phaseSettleSeconds: 0.75,
  maxPhaseCorrectionRate: 0.08,
  phaseDeadbandBeats: 0.001,
  rateSmoothingSeconds: 0.04,
  lockThresholdBeats: 0.01,
  staleSnapshotSeconds: 0.1,
};

export function wrapBeatError(error: number): number {
  if (!Number.isFinite(error)) throw new RangeError('phase error must be finite');
  return ((error + 0.5) % 1 + 1) % 1 - 0.5;
}

export function computeTempoMatchedRate(
  leaderEffectiveRate: number,
  leaderBpm: number,
  followerBpm: number,
): number {
  if (!Number.isFinite(leaderEffectiveRate) || leaderEffectiveRate <= 0) {
    throw new RangeError('leaderEffectiveRate must be positive');
  }
  if (!Number.isFinite(leaderBpm) || leaderBpm <= 0) {
    throw new RangeError('leaderBpm must be positive');
  }
  if (!Number.isFinite(followerBpm) || followerBpm <= 0) {
    throw new RangeError('followerBpm must be positive');
  }
  return leaderEffectiveRate * (leaderBpm / followerBpm);
}

export function computePhaseCorrectionRate(
  phaseErrorBeats: number,
  followerBpm: number,
  options: SyncControlOptions = DEFAULT_SYNC_OPTIONS,
): number {
  const error = wrapBeatError(phaseErrorBeats);
  if (Math.abs(error) <= options.phaseDeadbandBeats) return 0;
  const raw = (error * 60) / (followerBpm * options.phaseSettleSeconds);
  return Math.min(
    Math.max(raw, -options.maxPhaseCorrectionRate),
    options.maxPhaseCorrectionRate,
  );
}

export function computeSyncTargetRate(
  leaderEffectiveRate: number,
  leaderBpm: number,
  followerBpm: number,
  phaseErrorBeats: number,
  options: SyncControlOptions = DEFAULT_SYNC_OPTIONS,
): {
  tempoMatchedRate: number;
  correctionRate: number;
  targetRate: number;
  locked: boolean;
} {
  const tempoMatchedRate = computeTempoMatchedRate(
    leaderEffectiveRate,
    leaderBpm,
    followerBpm,
  );
  const correctionRate = computePhaseCorrectionRate(
    phaseErrorBeats,
    followerBpm,
    options,
  );
  const targetRate = Math.min(Math.max(tempoMatchedRate + correctionRate, 0.25), 4);
  return {
    tempoMatchedRate,
    correctionRate,
    targetRate,
    locked: Math.abs(wrapBeatError(phaseErrorBeats)) <= options.lockThresholdBeats,
  };
}

export function smoothRate(
  currentRate: number,
  targetRate: number,
  elapsedSeconds: number,
  smoothingSeconds: number,
): number {
  if (smoothingSeconds <= 0) return targetRate;
  const alpha = 1 - Math.exp(-elapsedSeconds / smoothingSeconds);
  return currentRate + (targetRate - currentRate) * alpha;
}
