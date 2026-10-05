import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import { cueNormalization, monitorBlendGains } from './MonitorCueMath';

type DeckId = 'A' | 'B';

type SinkSelectableAudioElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export interface MonitorOutputDevice {
  deviceId: string;
  label: string;
}

export interface MonitorCueStatus {
  cueA: boolean;
  cueB: boolean;
  blend: number;
  level: number;
  cueGain: number;
  masterGain: number;
  cueNormalization: number;
  activeCueCount: number;
  outputEnabled: boolean;
  outputSelectionSupported: boolean;
  sinkId: string;
  monitorRms: number;
}

export class MonitorCueController {
  readonly cueAInput: GainNode;
  readonly cueBInput: GainNode;
  readonly masterInput: GainNode;

  private readonly cueBus: GainNode;
  private readonly cueBlendGain: GainNode;
  private readonly masterBlendGain: GainNode;
  private readonly levelGain: GainNode;
  private readonly analyser: AnalyserNode;
  private readonly mediaDestination: MediaStreamAudioDestinationNode;
  private readonly output: SinkSelectableAudioElement;

  private cueA = false;
  private cueB = false;
  private blend = 0;
  private level = 0.8;
  private outputEnabled = false;
  private sinkId = 'default';

  constructor(private readonly runtime: BrowserAudioRuntime) {
    const context = runtime.context;
    this.cueAInput = context.createGain();
    this.cueBInput = context.createGain();
    this.masterInput = context.createGain();
    this.cueBus = context.createGain();
    this.cueBlendGain = context.createGain();
    this.masterBlendGain = context.createGain();
    this.levelGain = context.createGain();
    this.analyser = context.createAnalyser();
    this.mediaDestination = context.createMediaStreamDestination();

    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;

    this.cueAInput.connect(this.cueBus);
    this.cueBInput.connect(this.cueBus);
    this.cueBus.connect(this.cueBlendGain).connect(this.levelGain);
    this.masterInput.connect(this.masterBlendGain).connect(this.levelGain);
    this.levelGain.connect(this.analyser).connect(this.mediaDestination);

    this.output = new Audio() as SinkSelectableAudioElement;
    this.output.preload = 'none';
    this.output.autoplay = false;
    this.output.srcObject = this.mediaDestination.stream;

    this.cueAInput.gain.value = 0;
    this.cueBInput.gain.value = 0;
    this.setBlend(0);
    this.setLevel(this.level);
  }

  setCue(deck: DeckId, enabled: boolean): void {
    if (deck === 'A') this.cueA = enabled;
    else this.cueB = enabled;
    this.applyCueRouting();
  }

  setBlend(position: number): void {
    const gains = monitorBlendGains(position);
    this.blend = position;
    this.cueBlendGain.gain.setValueAtTime(gains.cueGain, this.runtime.context.currentTime);
    this.masterBlendGain.gain.setValueAtTime(gains.masterGain, this.runtime.context.currentTime);
  }

  setLevel(level: number): void {
    if (!Number.isFinite(level) || level < 0 || level > 1) {
      throw new RangeError('monitor level must be between 0 and 1');
    }
    this.level = level;
    this.levelGain.gain.setValueAtTime(level, this.runtime.context.currentTime);
  }

  async enableOutput(): Promise<MonitorCueStatus> {
    await this.runtime.resume();
    await this.output.play();
    this.outputEnabled = true;
    return this.status();
  }

  disableOutput(): MonitorCueStatus {
    this.output.pause();
    this.outputEnabled = false;
    return this.status();
  }

  async listOutputDevices(): Promise<MonitorOutputDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'audiooutput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Audio output ${index + 1}`,
      }));
  }

  async setOutputDevice(deviceId: string): Promise<MonitorCueStatus> {
    if (!deviceId) throw new Error('output device id is required');
    if (!this.output.setSinkId) {
      throw new Error('selectable monitor output is not supported by this browser');
    }
    await this.output.setSinkId(deviceId);
    this.sinkId = this.output.sinkId || deviceId;
    return this.status();
  }

  status(): MonitorCueStatus {
    const gains = monitorBlendGains(this.blend);
    const activeCueCount = Number(this.cueA) + Number(this.cueB);
    return {
      cueA: this.cueA,
      cueB: this.cueB,
      blend: this.blend,
      level: this.level,
      cueGain: gains.cueGain,
      masterGain: gains.masterGain,
      cueNormalization: cueNormalization(activeCueCount),
      activeCueCount,
      outputEnabled: this.outputEnabled,
      outputSelectionSupported: typeof this.output.setSinkId === 'function',
      sinkId: this.sinkId,
      monitorRms: this.measureRms(),
    };
  }

  close(): void {
    this.output.pause();
    this.output.srcObject = null;
    this.outputEnabled = false;
    this.cueAInput.disconnect();
    this.cueBInput.disconnect();
    this.masterInput.disconnect();
    this.cueBus.disconnect();
    this.cueBlendGain.disconnect();
    this.masterBlendGain.disconnect();
    this.levelGain.disconnect();
    this.analyser.disconnect();
    this.mediaDestination.disconnect();
  }

  private applyCueRouting(): void {
    const count = Number(this.cueA) + Number(this.cueB);
    const gain = cueNormalization(count);
    const now = this.runtime.context.currentTime;
    this.cueAInput.gain.setValueAtTime(this.cueA ? gain : 0, now);
    this.cueBInput.gain.setValueAtTime(this.cueB ? gain : 0, now);
  }

  private measureRms(): number {
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sumSquares = 0;
    for (const value of data) sumSquares += value * value;
    return Math.sqrt(sumSquares / data.length);
  }
}
