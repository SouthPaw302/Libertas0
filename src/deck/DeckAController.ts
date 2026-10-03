import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import { DecodeAudioDataProvider, type DecodedPcm, type PcmDecoder } from './PcmDecoder';

export interface DeckAProcessorStatus {
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
  loaded: boolean;
  decoderProvider: string | null;
  sourceFrame: number;
  sourceFrames: number;
  sourceChannels: number;
  sourceSampleRate: number;
  durationSeconds: number;
  playing: boolean;
  ended: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  outputPeak: number;
}

export interface DeckAStatus extends DeckAProcessorStatus {
  contextState: AudioContextState;
  baseLatency: number | null;
  outputLatency: number | null;
}

interface PendingRequest {
  resolve: (status: DeckAStatus) => void;
  reject: (error: Error) => void;
  timeout: number;
}

export class DeckAController {
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private requestSequence = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly decoder: PcmDecoder;

  constructor(
    private readonly runtime: BrowserAudioRuntime,
    decoder?: PcmDecoder,
  ) {
    this.decoder = decoder ?? new DecodeAudioDataProvider(runtime);
  }

  async initialize(): Promise<void> {
    if (this.node) return;

    await this.runtime.ensureWorkletModule('/audio/libertas-deck-a.worklet.js');
    const context = this.runtime.context;
    const node = new AudioWorkletNode(context, 'libertas-deck-a', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      parameterData: {
        volume: 1,
        playbackRate: 1,
      },
    });

    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;

    node.port.onmessage = (event: MessageEvent<DeckAProcessorStatus>) => {
      const message = event.data;
      if (!message || message.type !== 'response') return;
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      window.clearTimeout(pending.timeout);
      this.pending.delete(message.requestId);

      if (!message.ok) {
        pending.reject(new Error(message.error ?? 'Deck A worklet request failed'));
        return;
      }
      pending.resolve(this.mergeStatus(message));
    };

    node.connect(analyser);
    analyser.connect(context.destination);

    this.node = node;
    this.analyser = analyser;
  }

  async loadEncodedAudio(encoded: ArrayBuffer): Promise<DeckAStatus> {
    await this.initialize();
    const pcm = await this.decoder.decode(encoded);
    return this.loadDecodedPcm(pcm);
  }

  async loadFile(file: File): Promise<DeckAStatus> {
    return this.loadEncodedAudio(await file.arrayBuffer());
  }

  async play(): Promise<DeckAStatus> {
    await this.initialize();
    await this.runtime.resume();
    return this.request('play');
  }

  pause(): Promise<DeckAStatus> {
    return this.request('pause');
  }

  seekFrame(frame: number): Promise<DeckAStatus> {
    if (!Number.isFinite(frame)) throw new RangeError('seek frame must be finite');
    return this.request('seek', { frame });
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate < 0.25 || rate > 4) {
      throw new RangeError('playback rate must be between 0.25 and 4');
    }
    const parameter = this.requireParameter('playbackRate');
    parameter.setValueAtTime(rate, this.runtime.context.currentTime);
  }

  setVolume(volume: number, timeConstantSeconds = 0.005): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError('volume must be between 0 and 1');
    }
    const parameter = this.requireParameter('volume');
    const now = this.runtime.context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setTargetAtTime(volume, now, Math.max(timeConstantSeconds, 0.001));
  }

  setMuted(muted: boolean): Promise<DeckAStatus> {
    return this.request('mute', { muted });
  }

  requestStatus(timeoutMs = 2_000): Promise<DeckAStatus> {
    return this.request('status', {}, [], timeoutMs);
  }

  measureRms(): number {
    const analyser = this.requireAnalyser();
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let sumSquares = 0;
    for (const value of data) sumSquares += value * value;
    return Math.sqrt(sumSquares / data.length);
  }

  async close(): Promise<void> {
    for (const [id, pending] of this.pending) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error(`Deck A closed before response: ${id}`));
    }
    this.pending.clear();
    this.node?.disconnect();
    this.analyser?.disconnect();
    this.node = null;
    this.analyser = null;
  }

  private async loadDecodedPcm(pcm: DecodedPcm): Promise<DeckAStatus> {
    const channelBuffers = pcm.channels.map((channel) => channel.buffer as ArrayBuffer);
    return this.request(
      'load',
      {
        decoderProvider: pcm.provider,
        sourceSampleRate: pcm.sampleRate,
        sourceFrames: pcm.frameCount,
        sourceChannels: pcm.channelCount,
        durationSeconds: pcm.durationSeconds,
        channelBuffers,
      },
      channelBuffers,
      5_000,
    );
  }

  private request(
    command: string,
    payload: Record<string, unknown> = {},
    transfer: Transferable[] = [],
    timeoutMs = 2_000,
  ): Promise<DeckAStatus> {
    const node = this.requireNode();
    const requestId = this.requestSequence++;

    return new Promise<DeckAStatus>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Deck A request timed out: ${command}#${requestId}`));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timeout });
      node.port.postMessage({ type: command, requestId, ...payload }, transfer);
    });
  }

  private mergeStatus(message: DeckAProcessorStatus): DeckAStatus {
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

  private requireNode(): AudioWorkletNode {
    if (!this.node) throw new Error('Deck A is not initialized');
    return this.node;
  }

  private requireAnalyser(): AnalyserNode {
    if (!this.analyser) throw new Error('Deck A analyser is not initialized');
    return this.analyser;
  }

  private requireParameter(name: 'volume' | 'playbackRate'): AudioParam {
    const parameter = this.requireNode().parameters.get(name);
    if (!parameter) throw new Error(`Deck A AudioParam is unavailable: ${name}`);
    return parameter;
  }
}
