import {
  BrowserAudioRuntime,
  detectAudioRuntimeCapabilities,
  type AudioRuntimeCapabilities,
} from './BrowserAudioRuntime';

export type AudioKernelCapabilities = AudioRuntimeCapabilities;

export interface AudioKernelProcessorStatus {
  currentFrame: number;
  sampleRate: number;
  renderQuantum: number;
  processedFrames: number;
  processCalls: number;
  frameDiscontinuities: number;
  signalRunning: boolean;
  frequencyHz: number;
  gain: number;
}

export interface AudioKernelStatus extends AudioKernelProcessorStatus {
  contextState: AudioContextState;
  baseLatency: number | null;
  outputLatency: number | null;
}

interface StatusMessage extends AudioKernelProcessorStatus {
  type: 'status';
  requestId: number;
}

interface PendingStatus {
  resolve: (status: AudioKernelStatus) => void;
  reject: (error: Error) => void;
  timeout: number;
}

export const detectAudioKernelCapabilities = detectAudioRuntimeCapabilities;

export class BrowserAudioKernel {
  private node: AudioWorkletNode | null = null;
  private requestSequence = 1;
  private readonly pending = new Map<number, PendingStatus>();
  private readonly runtime: BrowserAudioRuntime;
  private readonly ownsRuntime: boolean;

  constructor(runtime?: BrowserAudioRuntime) {
    this.runtime = runtime ?? new BrowserAudioRuntime();
    this.ownsRuntime = !runtime;
  }

  async initialize(): Promise<void> {
    if (this.node) return;

    await this.runtime.ensureWorkletModule('/audio/libertas-kernel.worklet.js');
    const context = this.runtime.context;
    const node = new AudioWorkletNode(context, 'libertas-kernel', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    node.port.onmessage = (event: MessageEvent<StatusMessage>) => {
      const message = event.data;
      if (!message || message.type !== 'status') return;
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      window.clearTimeout(pending.timeout);
      this.pending.delete(message.requestId);
      pending.resolve(this.mergeStatus(message));
    };

    node.connect(context.destination);
    this.node = node;
  }

  async startSignal(frequencyHz = 220, gain = 0.03): Promise<void> {
    await this.initialize();
    await this.runtime.resume();

    this.requireNode().port.postMessage({
      type: 'configure',
      signalRunning: true,
      frequencyHz,
      gain,
    });
  }

  stopSignal(): void {
    this.requireNode().port.postMessage({ type: 'configure', signalRunning: false });
  }

  setGain(gain: number): void {
    if (!Number.isFinite(gain) || gain < 0 || gain > 1) {
      throw new RangeError('gain must be between 0 and 1');
    }
    this.requireNode().port.postMessage({ type: 'configure', gain });
  }

  requestStatus(timeoutMs = 2_000): Promise<AudioKernelStatus> {
    const node = this.requireNode();
    const requestId = this.requestSequence++;

    return new Promise<AudioKernelStatus>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`audio kernel status request timed out: ${requestId}`));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timeout });
      node.port.postMessage({ type: 'status', requestId });
    });
  }

  async close(): Promise<void> {
    for (const [id, pending] of this.pending) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error(`audio kernel closed before status response: ${id}`));
    }
    this.pending.clear();

    this.node?.disconnect();
    this.node = null;

    if (this.ownsRuntime) {
      await this.runtime.close();
    }
  }

  private mergeStatus(message: StatusMessage): AudioKernelStatus {
    const context = this.runtime.context;
    return {
      currentFrame: message.currentFrame,
      sampleRate: message.sampleRate,
      renderQuantum: message.renderQuantum,
      processedFrames: message.processedFrames,
      processCalls: message.processCalls,
      frameDiscontinuities: message.frameDiscontinuities,
      signalRunning: message.signalRunning,
      frequencyHz: message.frequencyHz,
      gain: message.gain,
      contextState: context.state,
      baseLatency: Number.isFinite(context.baseLatency) ? context.baseLatency : null,
      outputLatency:
        'outputLatency' in context && Number.isFinite(context.outputLatency)
          ? context.outputLatency
          : null,
    };
  }

  private requireNode(): AudioWorkletNode {
    if (!this.node) throw new Error('audio kernel is not initialized');
    return this.node;
  }
}
