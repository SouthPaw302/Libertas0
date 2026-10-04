import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SYNC_OPTIONS,
  computePhaseCorrectionRate,
  computeSyncTargetRate,
  computeTempoMatchedRate,
  smoothRate,
  wrapBeatError,
} from './SyncMath';

describe('SYNC control math', () => {
  it('wraps phase error to the nearest beat', () => {
    expect(wrapBeatError(0.6)).toBeCloseTo(-0.4, 12);
    expect(wrapBeatError(-0.6)).toBeCloseTo(0.4, 12);
    expect(wrapBeatError(2.125)).toBeCloseTo(0.125, 12);
  });

  it('matches tempo using the ratio of leader/follower grids', () => {
    expect(computeTempoMatchedRate(1, 120, 128)).toBeCloseTo(0.9375, 12);
    expect(computeTempoMatchedRate(1.05, 120, 128)).toBeCloseTo(0.984375, 12);
  });

  it('bounds phase correction and observes the deadband', () => {
    expect(computePhaseCorrectionRate(0.0005, 120)).toBe(0);
    expect(computePhaseCorrectionRate(0.49, 120)).toBeLessThanOrEqual(
      DEFAULT_SYNC_OPTIONS.maxPhaseCorrectionRate,
    );
    expect(computePhaseCorrectionRate(-0.49, 120)).toBeGreaterThanOrEqual(
      -DEFAULT_SYNC_OPTIONS.maxPhaseCorrectionRate,
    );
  });

  it('never asks the deck to leave its supported rate domain', () => {
    expect(computeSyncTargetRate(4, 1000, 1, 0.4).targetRate).toBe(4);
    expect(computeSyncTargetRate(0.25, 1, 1000, -0.4).targetRate).toBe(0.25);
  });

  it('smooths corrections without an instantaneous rate jump', () => {
    const first = smoothRate(1, 0.9, 128 / 48_000, 0.04);
    expect(first).toBeLessThan(1);
    expect(first).toBeGreaterThan(0.9);
  });

  it('converges a mismatched follower from a large phase offset without seeks', () => {
    const sampleRate = 48_000;
    const leaderBpm = 120;
    const followerBpm = 128;
    const leaderRate = 1;
    const block = 128;
    const followerFramesPerBeat = (sampleRate * 60) / followerBpm;
    const leaderFramesPerBeat = (sampleRate * 60) / leaderBpm;

    let leaderFrame = 0;
    let followerFrame = followerFramesPerBeat * 0.35;
    let followerRate = 1;
    let maxAbsError = 0;

    for (let i = 0; i < 5_000; i += 1) {
      const leaderBeat = leaderFrame / leaderFramesPerBeat;
      const followerBeat = followerFrame / followerFramesPerBeat;
      const phaseError = wrapBeatError(leaderBeat - followerBeat);
      maxAbsError = Math.max(maxAbsError, Math.abs(phaseError));
      const target = computeSyncTargetRate(
        leaderRate,
        leaderBpm,
        followerBpm,
        phaseError,
      ).targetRate;
      followerRate = smoothRate(
        followerRate,
        target,
        block / sampleRate,
        DEFAULT_SYNC_OPTIONS.rateSmoothingSeconds,
      );
      leaderFrame += block * leaderRate;
      followerFrame += block * followerRate;
    }

    const finalError = wrapBeatError(
      leaderFrame / leaderFramesPerBeat - followerFrame / followerFramesPerBeat,
    );
    expect(maxAbsError).toBeGreaterThan(0.3);
    expect(Math.abs(finalError)).toBeLessThan(0.003);
    expect(followerRate).toBeCloseTo(120 / 128, 3);
  });
});
