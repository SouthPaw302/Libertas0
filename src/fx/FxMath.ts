export interface DryWetGains {
  dryGain: number;
  wetGain: number;
}

export function equalPowerDryWet(wet: number): DryWetGains {
  if (!Number.isFinite(wet) || wet < 0 || wet > 1) {
    throw new RangeError('wet must be between 0 and 1');
  }
  const angle = wet * Math.PI * 0.5;
  return {
    dryGain: Math.cos(angle),
    wetGain: Math.sin(angle),
  };
}

export function beatDelaySeconds(
  bpm: number,
  beats: number,
  maxDelaySeconds = 4,
): number {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError('bpm must be positive');
  if (!Number.isFinite(beats) || beats <= 0) throw new RangeError('beats must be positive');
  if (!Number.isFinite(maxDelaySeconds) || maxDelaySeconds <= 0) {
    throw new RangeError('maxDelaySeconds must be positive');
  }
  return Math.min(maxDelaySeconds, (60 / bpm) * beats);
}

export function effectiveTempoBpm(gridBpm: number, playbackRate: number): number {
  if (!Number.isFinite(gridBpm) || gridBpm <= 0) throw new RangeError('grid bpm must be positive');
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) throw new RangeError('playback rate must be positive');
  return gridBpm * playbackRate;
}

export function fxToneFrequency(position: number): number {
  if (!Number.isFinite(position) || position < 0 || position > 1) {
    throw new RangeError('tone must be between 0 and 1');
  }
  const min = 800;
  const max = 18_000;
  return min * (max / min) ** position;
}
