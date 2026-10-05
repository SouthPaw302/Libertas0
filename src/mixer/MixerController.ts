import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import type { AutomationPoint } from '../automation/AutomationTypes';

export interface MixerProcessorStatus {
  type: 'response';
  requestId: number;
  ok: boolean;
  error?: string;
  outputCurrentFrame: number;
  sampleRate: number;
  renderQuantum: number;
  processCalls: number;
  processedOutputFrames: number;
  frameDiscontinuities: number;
  masterVolume: number;
  crossfader: number;
  crossfaderGainA: number;
  crossfaderGainB: number;
  inputAPeak: number;
  inputBPeak: number;
  summedPeakBeforeClamp: number;
  outputPeak: number;
  clippedSamples: number;
  limitedSamples: number;
  hardClippedSamplesAfterLimiter: number;
  limiterThreshold: number;
  limiterGain: number;
  limiterGainReductionDb: number;
  maxLimiterGainReductionDb: number;
}

export interface MixerOutputTarget {
  node: AudioNode;
  input?: number;
}

export interface MixerStatus extends MixerProcessorStatus {
  contextState: AudioContextState;
  baseLatency: number | null;
  outputLatency: number | null;
}

interface PendingRequest {
  resolve: (status: MixerStatus) => void;
  reject: (error: Error) => void;
  timeout: number;
}

export class MixerController {
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private requestSequence = 1;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(
    private readonly runtime: BrowserAudioRuntime,
    private readonly outputTarget?: MixerOutputTarget,
  ) {}

  async initialize(): Promise<void> {
    if (this.node) return;

    await this.runtime.ensureWorkletModule('/audio/libertas-mixer.worklet.js');
    const context = this.runtime.context;
    const node = new AudioWorkletNode(context, 'libertas-mixer', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      parameterData: {
        masterVolume: 1,
        crossfader: 0,
        limiterThreshold: 0.98,
      },
    });

    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;

    node.port.onmessage = (event: MessageEvent<MixerProcessorStatus>) => {
      const message = event.data;
      if (!message || message.type !== 'response') return;
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      window.clearTimeout(pending.timeout);
      this.pending.delete(message.requestId);
      if (!message.ok) {
        pending.reject(new Error(message.error ?? 'Mixer worklet request failed'));
        return;
      }
      pending.resolve(this.mergeStatus(message));
    };

    node.connect(analyser);
    if (this.outputTarget) {
      analyser.connect(this.outputTarget.node, 0, this.outputTarget.input ?? 0);
    } else {
      analyser.connect(context.destination);
    }
    this.node = node;
    this.analyser = analyser;
  }

  get inputNode(): AudioWorkletNode {
    if (!this.node) throw new Error('Mixer is not initialized');
    return this.node;
  }

  setMasterVolume(volume: number, timeConstantSeconds = 0.005): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError('master volume must be between 0 and 1');
    }
    const parameter = this.requireParameter('masterVolume');
    const now = this.runtime.context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setTargetAtTime(volume, now, Math.max(timeConstantSeconds, 0.001));
  }

  setCrossfader(position: number, timeConstantSeconds = 0.005): void {
    if (!Number.isFinite(position) || position < -1 || position > 1) {
      throw new RangeError('crossfader must be between -1 and 1');
    }
    const parameter = this.requireParameter('crossfader');
    const now = this.runtime.context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setTargetAtTime(position, now, Math.max(timeConstantSeconds, 0.001));
  }

  setLimiterThreshold(threshold: number): void {
    if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) {
      throw new RangeError('limiter threshold must be between 0.5 and 1');
    }
    const parameter = this.requireParameter('limiterThreshold');
    parameter.setValueAtTime(threshold, this.runtime.context.currentTime);
  }

  connectOutput(target: AudioNode): void {
    if (!this.analyser) throw new Error('Mixer analyser is not initialized');
    this.analyser.connect(target);
  }

  disconnectOutput(target: AudioNode): void {
    this.analyser?.disconnect(target);
  }

  scheduleMasterVolume(points: AutomationPoint[], startContextTime: number): void {
    this.scheduleParameter('masterVolume', points, startContextTime, 0, 1);
  }

  scheduleCrossfader(points: AutomationPoint[], startContextTime: number): void {
    this.scheduleParameter('crossfader', points, startContextTime, -1, 1);
  }

  cancelAutomation(name: 'masterVolume' | 'crossfader', fromContextTime: number): void {
    this.requireParameter(name).cancelScheduledValues(fromContextTime);
  }

  requestStatus(timeoutMs = 2_000): Promise<MixerStatus> {
    const node = this.inputNode;
    const requestId = this.requestSequence++;

    return new Promise<MixerStatus>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Mixer status request timed out: ${requestId}`));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeout });
      node.port.postMessage({ type: 'status', requestId });
    });
  }

  measureRms(): number {
    if (!this.analyser) throw new Error('Mixer analyser is not initialized');
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sumSquares = 0;
    for (const value of data) sumSquares += value * value;
    return Math.sqrt(sumSquares / data.length);
  }

  async close(): Promise<void> {
    for (const [id, pending] of this.pending) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error(`Mixer closed before response: ${id}`));
    }
    this.pending.clear();
    this.node?.disconnect();
    this.analyser?.disconnect();
    this.node = null;
    this.analyser = null;
  }

  private mergeStatus(message: MixerProcessorStatus): MixerStatus {
    const context = this.runtime.context;
    return {
      ...message,
      contextState: context.state,
      baseLatency: Number.isFinite(context.baseLatency) ? context.baseLatency : null,
      outputLatency:
        'outputLatency' in context && Number.isFinite(context.outputLatency)
          ? context.outputLatency
          : null,
    };
  }

  private scheduleParameter(
    name: 'masterVolume' | 'crossfader',
    points: AutomationPoint[],
    startContextTime: number,
    min: number,
    max: number,
  ): void {
    if (points.length === 0) throw new RangeError('automation requires points');
    const parameter = this.requireParameter(name);
    parameter.cancelScheduledValues(startContextTime);
    points.forEach((point, index) => {
      if (!Number.isFinite(point.value) || point.value < min || point.value > max) {
        throw new RangeError(`${name} automation value out of range`);
      }
      const time = startContextTime + point.offsetSeconds;
      if (index === 0) parameter.setValueAtTime(point.value, time);
      else parameter.linearRampToValueAtTime(point.value, time);
    });
  }

  private requireParameter(name: 'masterVolume' | 'crossfader' | 'limiterThreshold'): AudioParam {
    const parameter = this.inputNode.parameters.get(name);
    if (!parameter) throw new Error(`Mixer AudioParam is unavailable: ${name}`);
    return parameter;
  }
}
