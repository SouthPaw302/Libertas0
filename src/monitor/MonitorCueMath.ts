export interface MonitorBlendGains {
  cueGain: number;
  masterGain: number;
}

export function monitorBlendGains(position: number): MonitorBlendGains {
  if (!Number.isFinite(position) || position < 0 || position > 1) {
    throw new RangeError('monitor blend must be between 0 and 1');
  }
  const angle = position * Math.PI * 0.5;
  return { cueGain: Math.cos(angle), masterGain: Math.sin(angle) };
}

export function cueNormalization(activeCueCount: number): number {
  if (!Number.isInteger(activeCueCount) || activeCueCount < 0 || activeCueCount > 2) {
    throw new RangeError('active cue count must be 0, 1, or 2');
  }
  return activeCueCount <= 1 ? 1 : 1 / Math.sqrt(activeCueCount);
}
