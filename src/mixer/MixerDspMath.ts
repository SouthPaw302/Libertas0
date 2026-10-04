export type EqBand = 'low' | 'mid' | 'high';

export interface CrossfaderGains {
  a: number;
  b: number;
}

export interface DjFilterFrequencies {
  lowpassHz: number;
  highpassHz: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function dbToLinear(db: number): number {
  if (!Number.isFinite(db)) throw new RangeError('dB value must be finite');
  return 10 ** (db / 20);
}

export function equalPowerCrossfader(position: number): CrossfaderGains {
  if (!Number.isFinite(position) || position < -1 || position > 1) {
    throw new RangeError('crossfader position must be between -1 and 1');
  }
  const angle = ((position + 1) * Math.PI) / 4;
  return {
    a: Math.cos(angle),
    b: Math.sin(angle),
  };
}

export function djFilterFrequencies(
  position: number,
  sampleRate: number,
): DjFilterFrequencies {
  if (!Number.isFinite(position) || position < -1 || position > 1) {
    throw new RangeError('filter position must be between -1 and 1');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('sampleRate must be positive');
  }

  const maxLowpass = Math.min(20_000, sampleRate * 0.45);
  const minLowpass = Math.min(80, maxLowpass);
  const minHighpass = 20;
  const maxHighpass = Math.min(12_000, sampleRate * 0.4);

  if (position < 0) {
    const t = -position;
    return {
      lowpassHz: maxLowpass * ((minLowpass / maxLowpass) ** t),
      highpassHz: minHighpass,
    };
  }

  if (position > 0) {
    const t = position;
    return {
      lowpassHz: maxLowpass,
      highpassHz: minHighpass * ((maxHighpass / minHighpass) ** t),
    };
  }

  return { lowpassHz: maxLowpass, highpassHz: minHighpass };
}
