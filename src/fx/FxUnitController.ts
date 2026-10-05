import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import {
  beatDelaySeconds,
  equalPowerDryWet,
  fxToneFrequency,
} from './FxMath';

export interface AudioOutputConnector {
  connectOutput(target: AudioNode, input?: number): void;
  disconnectOutput(target: AudioNode): void;
}

export interface FxUnitStatus {
  id: string;
  wet: number;
  dryGain: number;
  wetGain: number;
  tempoBpm: number;
  beatFraction: number;
  delaySeconds: number;
  feedback: number;
  tone: number;
  toneHz: number;
  outputRms: number;
}

export class FxUnitController implements AudioOutputConnector {
  readonly inputNode: GainNode;

  private readonly dryGain: GainNode;
  private readonly wetGain: GainNode;
  private readonly delay: DelayNode;
  private readonly feedbackGain: GainNode;
  private readonly feedbackFilter: BiquadFilterNode;
  private readonly outputGain: GainNode;
  private readonly analyser: AnalyserNode;

  private wet = 0;
  private tempoBpm = 120;
  private beatFraction = 0.5;
  private feedback = 0.35;
  private tone = 0.72;

  constructor(
    private readonly runtime: BrowserAudioRuntime,
    private readonly id: string,
  ) {
    const context = runtime.context;
    this.inputNode = context.createGain();
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();
    this.delay = context.createDelay(4);
    this.feedbackGain = context.createGain();
    this.feedbackFilter = context.createBiquadFilter();
    this.outputGain = context.createGain();
    this.analyser = context.createAnalyser();

    this.feedbackFilter.type = 'lowpass';
    this.feedbackFilter.Q.value = Math.SQRT1_2;
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;

    this.inputNode.connect(this.dryGain).connect(this.outputGain);
    this.inputNode.connect(this.delay).connect(this.wetGain).connect(this.outputGain);
    this.delay.connect(this.feedbackFilter).connect(this.feedbackGain).connect(this.delay);
    this.outputGain.connect(this.analyser);

    this.setWet(this.wet);
    this.setFeedback(this.feedback);
    this.setTone(this.tone);
    this.applyDelayTime(0);
  }

  setWet(wet: number, timeConstantSeconds = 0.01): void {
    const gains = equalPowerDryWet(wet);
    this.wet = wet;
    this.smooth(this.dryGain.gain, gains.dryGain, timeConstantSeconds);
    this.smooth(this.wetGain.gain, gains.wetGain, timeConstantSeconds);
  }

  setTempoBpm(bpm: number, timeConstantSeconds = 0.02): void {
    if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError('FX tempo must be positive');
    this.tempoBpm = bpm;
    this.applyDelayTime(timeConstantSeconds);
  }

  setBeatFraction(beats: number, timeConstantSeconds = 0.02): void {
    if (!Number.isFinite(beats) || beats < 0.125 || beats > 4) {
      throw new RangeError('FX beat fraction must be between 0.125 and 4 beats');
    }
    this.beatFraction = beats;
    this.applyDelayTime(timeConstantSeconds);
  }

  setFeedback(feedback: number, timeConstantSeconds = 0.01): void {
    if (!Number.isFinite(feedback) || feedback < 0 || feedback > 0.85) {
      throw new RangeError('FX feedback must be between 0 and 0.85');
    }
    this.feedback = feedback;
    this.smooth(this.feedbackGain.gain, feedback, timeConstantSeconds);
  }

  setTone(tone: number, timeConstantSeconds = 0.01): void {
    const frequency = fxToneFrequency(tone);
    this.tone = tone;
    this.smooth(this.feedbackFilter.frequency, frequency, timeConstantSeconds);
  }

  connectOutput(target: AudioNode, input = 0): void {
    this.analyser.connect(target, 0, input);
  }

  disconnectOutput(target: AudioNode): void {
    this.analyser.disconnect(target);
  }

  status(): FxUnitStatus {
    const gains = equalPowerDryWet(this.wet);
    return {
      id: this.id,
      wet: this.wet,
      dryGain: gains.dryGain,
      wetGain: gains.wetGain,
      tempoBpm: this.tempoBpm,
      beatFraction: this.beatFraction,
      delaySeconds: beatDelaySeconds(this.tempoBpm, this.beatFraction),
      feedback: this.feedback,
      tone: this.tone,
      toneHz: fxToneFrequency(this.tone),
      outputRms: this.measureRms(),
    };
  }

  close(): void {
    this.inputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.delay.disconnect();
    this.feedbackFilter.disconnect();
    this.feedbackGain.disconnect();
    this.outputGain.disconnect();
    this.analyser.disconnect();
  }

  private applyDelayTime(timeConstantSeconds: number): void {
    const seconds = beatDelaySeconds(this.tempoBpm, this.beatFraction);
    this.smooth(this.delay.delayTime, seconds, timeConstantSeconds);
  }

  private smooth(parameter: AudioParam, value: number, timeConstantSeconds: number): void {
    const now = this.runtime.context.currentTime;
    parameter.cancelScheduledValues(now);
    if (timeConstantSeconds <= 0) {
      parameter.setValueAtTime(value, now);
    } else {
      parameter.setTargetAtTime(value, now, Math.max(0.001, timeConstantSeconds));
    }
  }

  private measureRms(): number {
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sumSquares = 0;
    for (const sample of data) sumSquares += sample * sample;
    return Math.sqrt(sumSquares / data.length);
  }
}
