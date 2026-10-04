export interface SineWavOptions {
  durationSeconds?: number;
  sampleRate?: number;
  frequencyHz?: number;
  amplitude?: number;
  channels?: 1 | 2;
}

export function createSineWav(options: SineWavOptions = {}): ArrayBuffer {
  const durationSeconds = options.durationSeconds ?? 10;
  const sampleRate = options.sampleRate ?? 48_000;
  const frequencyHz = options.frequencyHz ?? 440;
  const amplitude = options.amplitude ?? 0.5;
  const channels = options.channels ?? 2;

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError('durationSeconds must be positive');
  }
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError('sampleRate must be a positive integer');
  }
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new RangeError('frequencyHz must be positive');
  }
  if (!Number.isFinite(amplitude) || amplitude <= 0 || amplitude > 1) {
    throw new RangeError('amplitude must be in (0, 1]');
  }

  const frames = Math.floor(durationSeconds * sampleRate);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    const sample = Math.sin((2 * Math.PI * frequencyHz * frame) / sampleRate) * amplitude;
    const value = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    for (let channel = 0; channel < channels; channel += 1) {
      view.setInt16(offset, value, true);
      offset += bytesPerSample;
    }
  }

  return buffer;
}

export interface ClickTrackWavOptions {
  durationSeconds?: number;
  sampleRate?: number;
  bpm?: number;
  amplitude?: number;
  clickDurationMs?: number;
  firstBeatOffsetSeconds?: number;
  channels?: 1 | 2;
}

export function createClickTrackWav(options: ClickTrackWavOptions = {}): ArrayBuffer {
  const durationSeconds = options.durationSeconds ?? 20;
  const sampleRate = options.sampleRate ?? 48_000;
  const bpm = options.bpm ?? 120;
  const amplitude = options.amplitude ?? 0.6;
  const clickDurationMs = options.clickDurationMs ?? 12;
  const firstBeatOffsetSeconds = options.firstBeatOffsetSeconds ?? 0;
  const channels = options.channels ?? 2;

  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError('bpm must be positive');

  const frames = Math.floor(durationSeconds * sampleRate);
  const clickFrames = Math.max(1, Math.floor((clickDurationMs / 1000) * sampleRate));
  const framesPerBeat = (sampleRate * 60) / bpm;
  const firstBeatFrame = Math.max(0, firstBeatOffsetSeconds * sampleRate);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    const relativeFrame = frame - firstBeatFrame;
    const beatFrame =
      relativeFrame >= 0
        ? ((relativeFrame % framesPerBeat) + framesPerBeat) % framesPerBeat
        : Number.POSITIVE_INFINITY;
    let sample = 0;
    if (beatFrame < clickFrames) {
      const envelope = Math.exp(-8 * (beatFrame / clickFrames));
      sample =
        Math.sin((2 * Math.PI * 1600 * beatFrame) / sampleRate) *
        envelope *
        amplitude;
    }
    const value = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    for (let channel = 0; channel < channels; channel += 1) {
      view.setInt16(offset, value, true);
      offset += bytesPerSample;
    }
  }

  return buffer;
}
