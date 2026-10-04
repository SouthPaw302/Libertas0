import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import { djFilterFrequencies, type EqBand } from './MixerDspMath';

export interface ChannelStripStatus {
  channelId: string;
  trimDb: number;
  lowEqDb: number;
  midEqDb: number;
  highEqDb: number;
  filter: number;
  lowpassHz: number;
  highpassHz: number;
}

export interface ChannelStripOutputTarget {
  node: AudioNode;
  input: number;
}

export class ChannelStripController {
  readonly inputNode: GainNode;

  private readonly lowEq: BiquadFilterNode;
  private readonly midEq: BiquadFilterNode;
  private readonly highEq: BiquadFilterNode;
  private readonly lowpass: BiquadFilterNode;
  private readonly highpass: BiquadFilterNode;
  private readonly analyser: AnalyserNode;

  private trimDb = 0;
  private lowEqDb = 0;
  private midEqDb = 0;
  private highEqDb = 0;
  private filter = 0;

  constructor(
    private readonly runtime: BrowserAudioRuntime,
    private readonly channelId: string,
    outputTarget: ChannelStripOutputTarget,
  ) {
    const context = runtime.context;

    this.inputNode = context.createGain();

    this.lowEq = context.createBiquadFilter();
    this.lowEq.type = 'lowshelf';
    this.lowEq.frequency.value = 120;

    this.midEq = context.createBiquadFilter();
    this.midEq.type = 'peaking';
    this.midEq.frequency.value = 1_000;
    this.midEq.Q.value = 0.8;

    this.highEq = context.createBiquadFilter();
    this.highEq.type = 'highshelf';
    this.highEq.frequency.value = 8_000;

    this.lowpass = context.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.Q.value = Math.SQRT1_2;

    this.highpass = context.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.Q.value = Math.SQRT1_2;

    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;

    this.inputNode
      .connect(this.lowEq)
      .connect(this.midEq)
      .connect(this.highEq)
      .connect(this.lowpass)
      .connect(this.highpass)
      .connect(this.analyser)
      .connect(outputTarget.node, 0, outputTarget.input);

    this.applyFilterFrequencies(0, 0);
  }

  setTrimDb(db: number, timeConstantSeconds = 0.01): void {
    this.assertRange('trim dB', db, -12, 12);
    this.trimDb = db;
    this.smooth(this.inputNode.gain, 10 ** (db / 20), timeConstantSeconds);
  }

  setEqDb(band: EqBand, db: number, timeConstantSeconds = 0.01): void {
    this.assertRange(`${band} EQ dB`, db, -24, 6);
    const target =
      band === 'low' ? this.lowEq :
      band === 'mid' ? this.midEq :
      this.highEq;

    if (band === 'low') this.lowEqDb = db;
    if (band === 'mid') this.midEqDb = db;
    if (band === 'high') this.highEqDb = db;

    this.smooth(target.gain, db, timeConstantSeconds);
  }

  setFilter(position: number, timeConstantSeconds = 0.01): void {
    this.assertRange('filter', position, -1, 1);
    this.filter = position;
    this.applyFilterFrequencies(position, timeConstantSeconds);
  }

  status(): ChannelStripStatus {
    const frequencies = djFilterFrequencies(this.filter, this.runtime.context.sampleRate);
    return {
      channelId: this.channelId,
      trimDb: this.trimDb,
      lowEqDb: this.lowEqDb,
      midEqDb: this.midEqDb,
      highEqDb: this.highEqDb,
      filter: this.filter,
      lowpassHz: frequencies.lowpassHz,
      highpassHz: frequencies.highpassHz,
    };
  }

  measureRms(): number {
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sumSquares = 0;
    for (const sample of data) sumSquares += sample * sample;
    return Math.sqrt(sumSquares / data.length);
  }

  close(): void {
    this.inputNode.disconnect();
    this.lowEq.disconnect();
    this.midEq.disconnect();
    this.highEq.disconnect();
    this.lowpass.disconnect();
    this.highpass.disconnect();
    this.analyser.disconnect();
  }

  private applyFilterFrequencies(position: number, timeConstantSeconds: number): void {
    const frequencies = djFilterFrequencies(position, this.runtime.context.sampleRate);
    this.smooth(this.lowpass.frequency, frequencies.lowpassHz, timeConstantSeconds);
    this.smooth(this.highpass.frequency, frequencies.highpassHz, timeConstantSeconds);
  }

  private smooth(parameter: AudioParam, value: number, timeConstantSeconds: number): void {
    const now = this.runtime.context.currentTime;
    parameter.cancelScheduledValues(now);
    if (timeConstantSeconds <= 0) {
      parameter.setValueAtTime(value, now);
      return;
    }
    parameter.setTargetAtTime(value, now, Math.max(timeConstantSeconds, 0.001));
  }

  private assertRange(name: string, value: number, min: number, max: number): void {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${name} must be between ${min} and ${max}`);
    }
  }
}
