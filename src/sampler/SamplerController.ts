import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';

export type SamplerPadMode = 'one-shot' | 'loop';
export type SamplerSourceDeck = 'A' | 'B';

export interface SamplerOutputTarget {
  node: AudioNode;
  input?: number;
}

export interface SamplerPadConfig {
  mode: SamplerPadMode;
  gain: number;
  quantizeBeats: number;
  sourceDeck: SamplerSourceDeck;
}

export interface SamplerPadStatus extends SamplerPadConfig {
  slot: number;
  loaded: boolean;
  name: string | null;
  durationSeconds: number;
  channels: number;
  sampleRate: number;
  activeVoices: number;
  triggerCount: number;
  lastScheduledAt: number | null;
}

export interface SamplerStatus {
  pads: SamplerPadStatus[];
  busRms: number;
}

export interface SamplerTriggerReceipt {
  slot: number;
  mode: SamplerPadMode;
  scheduledAt: number;
  durationSeconds: number;
  activeVoices: number;
}

interface RuntimePad {
  buffer: AudioBuffer | null;
  name: string | null;
  config: SamplerPadConfig;
  activeSources: Set<AudioBufferSourceNode>;
  triggerCount: number;
  lastScheduledAt: number | null;
}

const PAD_COUNT = 8;

function validateSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 1 || slot > PAD_COUNT) {
    throw new RangeError(`sampler slot must be an integer from 1 to ${PAD_COUNT}`);
  }
}

function defaultConfig(): SamplerPadConfig {
  return {
    mode: 'one-shot',
    gain: 0.8,
    quantizeBeats: 0,
    sourceDeck: 'A',
  };
}

export class SamplerController {
  private readonly bus: GainNode;
  private readonly analyser: AnalyserNode;
  private readonly pads = new Map<number, RuntimePad>();

  constructor(
    private readonly runtime: BrowserAudioRuntime,
    outputTarget: SamplerOutputTarget,
  ) {
    const context = runtime.context;
    this.bus = context.createGain();
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.bus.connect(this.analyser).connect(outputTarget.node, 0, outputTarget.input ?? 0);

    for (let slot = 1; slot <= PAD_COUNT; slot += 1) {
      this.pads.set(slot, {
        buffer: null,
        name: null,
        config: defaultConfig(),
        activeSources: new Set<AudioBufferSourceNode>(),
        triggerCount: 0,
        lastScheduledAt: null,
      });
    }
  }

  async loadEncoded(
    slot: number,
    encoded: ArrayBuffer,
    name: string,
    config?: Partial<SamplerPadConfig>,
  ): Promise<SamplerPadStatus> {
    validateSlot(slot);
    const audioBuffer = await this.runtime.context.decodeAudioData(encoded.slice(0));
    if (audioBuffer.numberOfChannels < 1 || audioBuffer.numberOfChannels > 2) {
      throw new Error(`Sampler accepts mono/stereo audio only; decoded ${audioBuffer.numberOfChannels} channels`);
    }
    const pad = this.requirePad(slot);
    this.stop(slot);
    pad.buffer = audioBuffer;
    pad.name = name;
    if (config) this.configure(slot, config);
    return this.padStatus(slot);
  }

  unload(slot: number): void {
    validateSlot(slot);
    const pad = this.requirePad(slot);
    this.stop(slot);
    pad.buffer = null;
    pad.name = null;
    pad.triggerCount = 0;
    pad.lastScheduledAt = null;
  }

  configure(slot: number, config: Partial<SamplerPadConfig>): SamplerPadStatus {
    validateSlot(slot);
    const pad = this.requirePad(slot);
    if (config.mode !== undefined && config.mode !== 'one-shot' && config.mode !== 'loop') {
      throw new RangeError('sampler mode must be one-shot or loop');
    }
    if (config.gain !== undefined && (!Number.isFinite(config.gain) || config.gain < 0 || config.gain > 1)) {
      throw new RangeError('sampler pad gain must be between 0 and 1');
    }
    if (config.quantizeBeats !== undefined && (
      !Number.isFinite(config.quantizeBeats) ||
      config.quantizeBeats < 0 ||
      config.quantizeBeats > 16
    )) {
      throw new RangeError('sampler quantize beats must be between 0 and 16');
    }
    if (config.sourceDeck !== undefined && config.sourceDeck !== 'A' && config.sourceDeck !== 'B') {
      throw new RangeError('sampler source deck must be A or B');
    }
    pad.config = { ...pad.config, ...config };
    return this.padStatus(slot);
  }

  trigger(slot: number, scheduledAt = this.runtime.context.currentTime): SamplerTriggerReceipt {
    validateSlot(slot);
    const pad = this.requirePad(slot);
    if (!pad.buffer) throw new Error(`Sampler pad ${slot} is empty`);
    if (!Number.isFinite(scheduledAt) || scheduledAt < 0) throw new RangeError('scheduled time must be non-negative');

    if (pad.config.mode === 'loop') {
      this.stop(slot, scheduledAt);
    }

    const source = this.runtime.context.createBufferSource();
    const gain = this.runtime.context.createGain();
    source.buffer = pad.buffer;
    source.loop = pad.config.mode === 'loop';
    gain.gain.value = pad.config.gain;
    source.connect(gain).connect(this.bus);
    pad.activeSources.add(source);
    source.onended = () => {
      pad.activeSources.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start(scheduledAt);

    pad.triggerCount += 1;
    pad.lastScheduledAt = scheduledAt;
    return {
      slot,
      mode: pad.config.mode,
      scheduledAt,
      durationSeconds: pad.buffer.duration,
      activeVoices: pad.activeSources.size,
    };
  }

  stop(slot: number, scheduledAt = this.runtime.context.currentTime): SamplerPadStatus {
    validateSlot(slot);
    const pad = this.requirePad(slot);
    for (const source of [...pad.activeSources]) {
      try {
        source.stop(scheduledAt);
      } catch {
        // A source may already have ended between the set snapshot and stop call.
      }
    }
    return this.padStatus(slot);
  }

  padStatus(slot: number): SamplerPadStatus {
    validateSlot(slot);
    const pad = this.requirePad(slot);
    return {
      slot,
      loaded: pad.buffer !== null,
      name: pad.name,
      durationSeconds: pad.buffer?.duration ?? 0,
      channels: pad.buffer?.numberOfChannels ?? 0,
      sampleRate: pad.buffer?.sampleRate ?? 0,
      activeVoices: pad.activeSources.size,
      triggerCount: pad.triggerCount,
      lastScheduledAt: pad.lastScheduledAt,
      ...pad.config,
    };
  }

  status(): SamplerStatus {
    return {
      pads: Array.from({ length: PAD_COUNT }, (_, index) => this.padStatus(index + 1)),
      busRms: this.measureRms(),
    };
  }

  close(): void {
    for (let slot = 1; slot <= PAD_COUNT; slot += 1) this.stop(slot);
    this.bus.disconnect();
    this.analyser.disconnect();
  }

  private requirePad(slot: number): RuntimePad {
    const pad = this.pads.get(slot);
    if (!pad) throw new Error(`Sampler pad unavailable: ${slot}`);
    return pad;
  }

  private measureRms(): number {
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sumSquares = 0;
    for (const sample of data) sumSquares += sample * sample;
    return Math.sqrt(sumSquares / data.length);
  }
}
