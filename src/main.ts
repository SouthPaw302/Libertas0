import { startWorkstationGui } from './ui/WorkstationGui';
import {
  BrowserAudioKernel,
  detectAudioKernelCapabilities,
  type AudioKernelStatus,
} from './audio/BrowserAudioKernel';
import { BrowserAudioRuntime } from './audio/BrowserAudioRuntime';
import { DeckAController, type DeckAStatus } from './deck/DeckAController';
import { DeckBController, type DeckBStatus } from './deck/DeckBController';
import type { DeckController, DeckStatus } from './deck/DeckController';
import { MixerController, type MixerStatus } from './mixer/MixerController';
import { ChannelStripController, type ChannelStripStatus } from './mixer/ChannelStripController';
import type { EqBand } from './mixer/MixerDspMath';
import { MonitorCueController, type MonitorCueStatus, type MonitorOutputDevice } from './monitor/MonitorCueController';
import { WaveformTrackView, type WaveformRenderSnapshot } from './waveform/WaveformTrackView';
import { FxUnitController, type FxUnitStatus } from './fx/FxUnitController';
import { effectiveTempoBpm } from './fx/FxMath';
import {
  SamplerController,
  type SamplerPadConfig,
  type SamplerPadStatus,
  type SamplerStatus,
  type SamplerTriggerReceipt,
} from './sampler/SamplerController';
import { SamplerBank, type SamplerBankPad } from './sampler/SamplerBank';
import { quantizedSamplerStart } from './sampler/SamplerTiming';
import { createClickTrackWav, createSineWav } from './testing/wavFixture';
import { SyncController, type DeckId, type SyncSessionStatus } from './sync/SyncController';
import { DEFAULT_SYNC_OPTIONS, type SyncControlOptions } from './sync/SyncMath';
import { PerformanceTransportController } from './transport/PerformanceTransportController';
import { MusicalClock, type BeatGrid, type MusicalPosition } from './music/MusicalClock';
import { TrackIntelligenceController } from './intelligence/TrackIntelligenceController';
import type { TrackAnalysisResult } from './intelligence/TrackAnalysisCore';
import { TrackLibrary, type LibraryCrate, type LibraryTrack } from './library/TrackLibrary';
import {
  type LibraryQuery,
  type LibraryTrackPreparation,
  defaultTrackMetadata,
} from './library/LibraryPreparation';
import { MidiMappingEngine, type MidiAction, type MidiBinding } from './midi/MidiMappingEngine';
import { WebMidiController, type MidiRuntimeStatus } from './midi/WebMidiController';
import {
  MidiProfileStore,
  type MidiControllerProfile,
  type MidiFeedbackBinding,
} from './midi/MidiProfileStore';
import {
  MidiFeedbackRouter,
  type MidiFeedbackMessage,
} from './midi/MidiFeedbackRouter';
import {
  MIDI_TARGETS,
  midiTarget,
  type MidiTargetDescriptor,
} from './midi/MidiTargetCatalog';
import { MasterRecordingController, type RecordingStatus } from './recording/MasterRecordingController';
import { AutomationController } from './automation/AutomationController';
import { AutoMixController, type AutoMixStatus } from './automix/AutoMixController';
import type { MixDeck, TransitionDecision } from './automix/TransitionPlanner';
import type { AutomationLane, ScheduledAutomation } from './automation/AutomationTypes';
import { DistributedSession } from './distributed/DistributedSession';
import { RtcDataChannelTransport } from './distributed/RtcDataChannelTransport';
import {
  DISTRIBUTED_CHANNEL_LABEL,
  type DistributedNode,
  type RemoteWorkResult,
} from './distributed/DistributedTypes';

interface LibertasKernelTestApi {
  start(): Promise<AudioKernelStatus>;
  stop(): Promise<AudioKernelStatus>;
  status(): Promise<AudioKernelStatus>;
  close(): Promise<void>;
  capabilities(): ReturnType<typeof detectAudioKernelCapabilities>;
  blockMainThread(milliseconds: number): void;
}

interface LibertasDeckTestApi {
  loadGeneratedTone(durationSeconds?: number, frequencyHz?: number, amplitude?: number): Promise<DeckStatus>;
  play(): Promise<DeckStatus>;
  pause(): Promise<DeckStatus>;
  seekFrame(frame: number): Promise<DeckStatus>;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): Promise<DeckStatus>;
  status(): Promise<DeckStatus>;
  rms(): number;
  blockMainThread(milliseconds: number): void;
  close(): Promise<void>;
}

interface LibertasMixerTestApi {
  status(): Promise<MixerStatus>;
  setMasterVolume(volume: number): void;
  setCrossfader(position: number): void;
  setLimiterThreshold(threshold: number): void;
  setChannelTrim(deck: 'A' | 'B', db: number): void;
  setChannelEq(deck: 'A' | 'B', band: EqBand, db: number): void;
  setChannelFilter(deck: 'A' | 'B', position: number): void;
  channelStatus(deck: 'A' | 'B'): ChannelStripStatus;
  channelRms(deck: 'A' | 'B'): number;
  rms(): number;
}

type FxScope = 'A' | 'B' | 'master';

interface LibertasFxTestApi {
  setWet(scope: FxScope, wet: number): void;
  setBeatFraction(scope: FxScope, beats: number): void;
  setFeedback(scope: FxScope, feedback: number): void;
  setTone(scope: FxScope, tone: number): void;
  setMasterTempoSource(deck: 'A' | 'B'): void;
  refreshTempo(): Promise<{ A: number; B: number; master: number }>;
  status(scope: FxScope): FxUnitStatus;
}

interface SamplerTriggerResult {
  receipt: SamplerTriggerReceipt;
  targetSourceFrame: number | null;
  sourceDeck: 'A' | 'B' | null;
  quantizeBeats: number;
}

interface LibertasSamplerTestApi {
  clear(): Promise<void>;
  loadGenerated(
    slot: number,
    durationSeconds?: number,
    frequencyHz?: number,
    config?: Partial<SamplerPadConfig>,
  ): Promise<SamplerPadStatus>;
  configure(slot: number, config: Partial<SamplerPadConfig>): Promise<SamplerPadStatus>;
  trigger(slot: number, options?: { quantizeBeats?: number; sourceDeck?: 'A' | 'B' }): Promise<SamplerTriggerResult>;
  stop(slot: number): SamplerPadStatus;
  status(): SamplerStatus;
  listBank(): Promise<SamplerBankPad[]>;
  unloadRuntime(slot: number): void;
  restore(): Promise<SamplerStatus>;
}

interface LibertasWaveformTestApi {
  refresh(deck: 'A' | 'B'): Promise<WaveformRenderSnapshot>;
  snapshot(deck: 'A' | 'B'): WaveformRenderSnapshot;
  envelope(deck: 'A' | 'B'): { buckets: number; sourceFrames: number; sampleRate: number } | null;
}

interface LibertasMonitorCueTestApi {
  setCue(deck: 'A' | 'B', enabled: boolean): void;
  setBlend(position: number): void;
  setLevel(level: number): void;
  enableOutput(): Promise<MonitorCueStatus>;
  disableOutput(): MonitorCueStatus;
  status(): MonitorCueStatus;
  listOutputs(): Promise<MonitorOutputDevice[]>;
  setOutputDevice(deviceId: string): Promise<MonitorCueStatus>;
}

interface MusicalClockSnapshot {
  grid: BeatGrid;
  position: MusicalPosition;
}

interface LibertasMusicalClockTestApi {
  setGrid(deck: 'A' | 'B', grid: BeatGrid): void;
  snapshot(deck: 'A' | 'B'): Promise<MusicalClockSnapshot>;
  snapshotBoth(): Promise<{ a: MusicalClockSnapshot; b: MusicalClockSnapshot }>;
  quantize(deck: 'A' | 'B', sourceFrame: number, quantumBeats?: number, direction?: 'previous' | 'nearest' | 'next'): number;
}

interface LibertasSyncTestApi {
  loadClickPair(durationSeconds?: number, bpmA?: number, bpmB?: number): Promise<{ a: DeckStatus; b: DeckStatus }>;
  enable(leader: DeckId, options?: Partial<SyncControlOptions>): Promise<SyncSessionStatus>;
  disable(): Promise<void>;
  status(): Promise<SyncSessionStatus>;
}

interface LibertasPerformanceTransportTestApi {
  setCueHere(): Promise<DeckStatus>;
  setCueFrame(frame: number): Promise<DeckStatus>;
  triggerCue(pause?: boolean): Promise<DeckStatus>;
  setHotCueHere(slot: number): Promise<DeckStatus>;
  setHotCue(slot: number, frame: number): Promise<DeckStatus>;
  triggerHotCue(slot: number): Promise<DeckStatus>;
  clearHotCue(slot: number): Promise<DeckStatus>;
  setLoopFrames(startFrame: number, endFrame: number): Promise<DeckStatus>;
  setBeatLoop(startBeat: number, lengthBeats: number): Promise<DeckStatus>;
  setLoopEnabled(enabled: boolean): Promise<DeckStatus>;
  clearLoop(): Promise<DeckStatus>;
  jogByFrames(deltaFrames: number): Promise<DeckStatus>;
  jogBySeconds(deltaSeconds: number): Promise<DeckStatus>;
}

interface LibertasIntelligenceTestApi {
  workerAvailable(): boolean;
  analyzeClick(options?: {
    durationSeconds?: number;
    bpm?: number;
    sampleRate?: number;
    firstBeatOffsetSeconds?: number;
  }): Promise<TrackAnalysisResult>;
  loadClick(deck: 'A' | 'B', options?: {
    durationSeconds?: number;
    bpm?: number;
    sampleRate?: number;
    firstBeatOffsetSeconds?: number;
  }): Promise<DeckStatus>;
  apply(deck: 'A' | 'B', result: TrackAnalysisResult): BeatGrid;
  grid(deck: 'A' | 'B'): BeatGrid;
}

interface LibertasLibraryTestApi {
  clear(): Promise<void>;
  importGenerated(name?: string, durationSeconds?: number, frequencyHz?: number): Promise<LibraryTrack>;
  list(): Promise<LibraryTrack[]>;
  search(query: LibraryQuery): Promise<LibraryTrack[]>;
  get(id: string): Promise<LibraryTrack | null>;
  prepare(id: string, preparation: Partial<LibraryTrackPreparation>): Promise<LibraryTrack>;
  capture(id: string, deck: 'A' | 'B'): Promise<LibraryTrack>;
  load(id: string, deck: 'A' | 'B'): Promise<DeckStatus>;
  createCrate(name: string): Promise<LibraryCrate>;
  listCrates(): Promise<LibraryCrate[]>;
  addToCrate(crateId: string, trackId: string): Promise<LibraryCrate>;
  removeFromCrate(crateId: string, trackId: string): Promise<LibraryCrate>;
  remove(id: string): Promise<void>;
}

interface LibertasMidiTestApi {
  apiAvailable(): boolean;
  connect(): Promise<MidiRuntimeStatus>;
  addBinding(binding: MidiBinding): void;
  clearBindings(): void;
  learn(
    target: string,
    mode: 'absolute' | 'trigger',
    min?: number,
    max?: number,
    inputId?: string | 'source',
  ): void;
  dispatch(data: number[], sourceInputId?: string): unknown;
  status(): MidiRuntimeStatus;
  targets(): MidiTargetDescriptor[];
  profiles(): MidiControllerProfile[];
  activeProfile(): MidiControllerProfile | null;
  saveProfile(name: string, id?: string): MidiControllerProfile;
  activateProfile(id: string | null): MidiControllerProfile | null;
  removeProfile(id: string): void;
  replaceFeedback(bindings: MidiFeedbackBinding[]): void;
  feedbackBindings(): MidiFeedbackBinding[];
  publishFeedback(target: string, value: number): MidiFeedbackMessage[];
  pulseFeedback(target: string): MidiFeedbackMessage[];
  feedbackLog(): MidiFeedbackMessage[];
}

interface LibertasRecordingTestApi {
  supported(): boolean;
  start(): RecordingStatus;
  stop(): Promise<{ status: RecordingStatus; size: number; type: string }>;
  status(): RecordingStatus;
}

interface LibertasAutoMixTestApi {
  plan(outgoing: MixDeck, bars?: number, phraseBars?: number): Promise<TransitionDecision>;
  arm(): Promise<AutoMixStatus>;
  cancel(reason?: string): AutoMixStatus;
  override(value: number): AutoMixStatus;
  status(): AutoMixStatus;
}

interface LibertasAutomationTestApi {
  targets(): string[];
  schedule(lane: AutomationLane, leadSeconds?: number): ScheduledAutomation;
  cancel(target: string): void;
}

interface LibertasDualDeckTestApi {
  loadGenerated(
    durationSeconds?: number,
    frequencyA?: number,
    frequencyB?: number,
    amplitude?: number,
  ): Promise<{ a: DeckStatus; b: DeckStatus }>;
  playBoth(): Promise<{ a: DeckStatus; b: DeckStatus }>;
  pauseBoth(): Promise<{ a: DeckStatus; b: DeckStatus }>;
  status(): Promise<{ a: DeckStatus; b: DeckStatus; mixer: MixerStatus }>;
  blockMainThread(milliseconds: number): void;
  close(): Promise<void>;
}

interface LibertasDistributedTestApi {
  rtcAvailable(): boolean;
  runControlStress(): Promise<{
    ordered: boolean;
    peerNegotiated: string[];
    aFrameDelta: number;
    bFrameDelta: number;
    mixerFrameDelta: number;
    aDiscontinuityDelta: number;
    bDiscontinuityDelta: number;
    mixerDiscontinuityDelta: number;
    crossfaderGainA: number;
    crossfaderGainB: number;
    hostRejectedMessages: number;
    remoteRejectedMessages: number;
  }>;
  runAnalysisRoundTrip(): Promise<RemoteWorkResult>;
}

declare global {
  interface Window {
    __libertasKernelTest: LibertasKernelTestApi;
    __libertasDeckATest: LibertasDeckTestApi;
    __libertasDeckBTest: LibertasDeckTestApi;
    __libertasMixerTest: LibertasMixerTestApi;
    __libertasMonitorCueTest: LibertasMonitorCueTestApi;
    __libertasWaveformTest: LibertasWaveformTestApi;
    __libertasFxTest: LibertasFxTestApi;
    __libertasSamplerTest: LibertasSamplerTestApi;
    __libertasDualDeckTest: LibertasDualDeckTestApi;
    __libertasMusicalClockTest: LibertasMusicalClockTestApi;
    __libertasSyncTest: LibertasSyncTestApi;
    __libertasPerformanceATest: LibertasPerformanceTransportTestApi;
    __libertasPerformanceBTest: LibertasPerformanceTransportTestApi;
    __libertasIntelligenceTest: LibertasIntelligenceTestApi;
    __libertasLibraryTest: LibertasLibraryTestApi;
    __libertasMidiTest: LibertasMidiTestApi;
    __libertasRecordingTest: LibertasRecordingTestApi;
    __libertasAutomationTest: LibertasAutomationTestApi;
    __libertasAutoMixTest: LibertasAutoMixTestApi;
    __libertasDistributedTest: LibertasDistributedTestApi;
  }
}

const runtime = new BrowserAudioRuntime();
await runtime.initialize();
const kernel = new BrowserAudioKernel(runtime);

const masterFx = new FxUnitController(runtime, 'master');
masterFx.connectOutput(runtime.context.destination);

const mixer = new MixerController(runtime, { node: masterFx.inputNode, input: 0 });
await mixer.initialize();

const sampler = new SamplerController(runtime, { node: mixer.inputNode, input: 2 });
const samplerBank = new SamplerBank();

const deckFxA = new FxUnitController(runtime, 'deck-a');
const deckFxB = new FxUnitController(runtime, 'deck-b');
deckFxA.connectOutput(mixer.inputNode, 0);
deckFxB.connectOutput(mixer.inputNode, 1);

const channelA = new ChannelStripController(runtime, 'A', { node: deckFxA.inputNode, input: 0 });
const channelB = new ChannelStripController(runtime, 'B', { node: deckFxB.inputNode, input: 0 });
const monitor = new MonitorCueController(runtime);
channelA.connectOutput(monitor.cueAInput);
channelB.connectOutput(monitor.cueBInput);
masterFx.connectOutput(monitor.masterInput);

const deckA = new DeckAController(runtime, undefined, { node: channelA.inputNode, input: 0 });
const deckB = new DeckBController(runtime, undefined, { node: channelB.inputNode, input: 0 });
const sync = new SyncController(deckA, deckB);
const performanceA = new PerformanceTransportController(deckA);
const performanceB = new PerformanceTransportController(deckB);
const intelligence = new TrackIntelligenceController(runtime);
const library = new TrackLibrary();
const midiEngine = new MidiMappingEngine();
const midiProfiles = new MidiProfileStore();
const midiFeedbackLog: MidiFeedbackMessage[] = [];
let webMidi!: WebMidiController;
const midiFeedback = new MidiFeedbackRouter((message) => {
  midiFeedbackLog.push(message);
  if (midiFeedbackLog.length > 128) midiFeedbackLog.splice(0, midiFeedbackLog.length - 128);
  try {
    if (message.outputId) webMidi.send(message.outputId, [...message.data], message.timestamp);
    else webMidi.sendAll([...message.data], message.timestamp);
  } catch {
    // Feedback remains best-effort when a physical MIDI output is absent/disconnected.
  }
});
const recording = new MasterRecordingController(runtime, masterFx);
const automation = new AutomationController(runtime.context);
const autoMix = new AutoMixController({
  context: runtime.context, deckA, deckB, mixer, sync,
  getGrid: (deck) => pendingGrids.get(deck)!,
});
// Human performance interaction always cancels a pending mix before the UI command.
document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const id = target.closest('button')?.id ?? '';
  if (!/^(deck-[ab]-(play|pause|load|seek)|perf-[ab]-|sync-(a-to-b|b-to-a|disable)|automation-demo)$/.test(id)) return;
  if (['PLANNED', 'ARMED', 'EXECUTING'].includes(autoMix.status().state)) {
    autoMix.cancel('MANUAL_PERFORMANCE');
  }
}, true);

function publishMidiActionFeedback(action: MidiAction): void {
  if (action.trigger) midiFeedback.pulse(action.target);
  else midiFeedback.publish(action.target, action.value);
}

function applyMidiAction(action: MidiAction): void {
  if (action.trigger && /^(deck[AB]\.|sync\.)/.test(action.target) &&
    ['PLANNED', 'ARMED', 'EXECUTING'].includes(autoMix.status().state)) {
    autoMix.cancel('MIDI_PERFORMANCE');
  }
  const finish = (): void => publishMidiActionFeedback(action);

  switch (action.target) {
    case 'mixer.crossfader':
      autoMix.manualOverride(action.value);
      finish();
      return;
    case 'mixer.master':
      mixer.setMasterVolume(action.value);
      finish();
      return;
    case 'channelA.trim':
      channelA.setTrimDb(action.value);
      finish();
      return;
    case 'channelB.trim':
      channelB.setTrimDb(action.value);
      finish();
      return;
    case 'channelA.filter':
      channelA.setFilter(action.value);
      finish();
      return;
    case 'channelB.filter':
      channelB.setFilter(action.value);
      finish();
      return;
    case 'deckA.volume':
      deckA.setVolume(action.value);
      finish();
      return;
    case 'deckB.volume':
      deckB.setVolume(action.value);
      finish();
      return;
    case 'deckA.playPause':
      if (action.trigger) {
        void deckA.requestStatus().then((status) => status.playing ? deckA.pause() : deckA.play());
        finish();
      }
      return;
    case 'deckB.playPause':
      if (action.trigger) {
        void deckB.requestStatus().then((status) => status.playing ? deckB.pause() : deckB.play());
        finish();
      }
      return;
    case 'deckA.cue':
      if (action.trigger) {
        void performanceA.triggerCue();
        finish();
      }
      return;
    case 'deckB.cue':
      if (action.trigger) {
        void performanceB.triggerCue();
        finish();
      }
      return;
    case 'deckA.hotcue1':
      if (action.trigger) {
        void performanceA.triggerHotCue(1);
        finish();
      }
      return;
    case 'deckB.hotcue1':
      if (action.trigger) {
        void performanceB.triggerHotCue(1);
        finish();
      }
      return;
    case 'sync.a-to-b':
      if (action.trigger) {
        void sync.enable('A', pendingGrids.get('A')!, pendingGrids.get('B')!);
        finish();
      }
      return;
    case 'sync.b-to-a':
      if (action.trigger) {
        void sync.enable('B', pendingGrids.get('B')!, pendingGrids.get('A')!);
        finish();
      }
      return;
    case 'sync.disable':
      if (action.trigger) {
        void sync.disable();
        finish();
      }
      return;
    case 'fx.A.wet':
      deckFxA.setWet(action.value);
      finish();
      return;
    case 'fx.B.wet':
      deckFxB.setWet(action.value);
      finish();
      return;
    case 'fx.master.wet':
      masterFx.setWet(action.value);
      finish();
      return;
    case 'monitor.cueA':
      if (action.trigger) {
        monitor.setCue('A', !monitor.status().cueA);
        finish();
      }
      return;
    case 'monitor.cueB':
      if (action.trigger) {
        monitor.setCue('B', !monitor.status().cueB);
        finish();
      }
      return;
    default: {
      const samplerTrigger = /^sampler\.pad([1-8])\.trigger$/.exec(action.target);
      if (samplerTrigger && action.trigger) {
        void triggerSamplerPad(Number(samplerTrigger[1]));
        finish();
        return;
      }
      const samplerGain = /^sampler\.pad([1-8])\.gain$/.exec(action.target);
      if (samplerGain) {
        void configureSamplerPad(Number(samplerGain[1]), { gain: action.value });
        finish();
        return;
      }
      throw new Error(`Unmapped MIDI target: ${action.target}`);
    }
  }
}

webMidi = new WebMidiController(midiEngine, applyMidiAction);

function applyMidiProfile(profile: MidiControllerProfile | null): MidiControllerProfile | null {
  midiEngine.replaceBindings(profile?.bindings ?? []);
  midiFeedback.replaceBindings(profile?.feedback ?? []);
  return profile;
}

applyMidiProfile(midiProfiles.active());

automation.register('mixer.master', {
  min: 0, max: 1,
  schedule: (points, start) => mixer.scheduleMasterVolume(points, start),
  cancel: (from) => mixer.cancelAutomation('masterVolume', from),
});
automation.register('mixer.crossfader', {
  min: -1, max: 1,
  schedule: (points, start) => mixer.scheduleCrossfader(points, start),
  cancel: (from) => mixer.cancelAutomation('crossfader', from),
});
automation.register('channelA.trim', {
  min: -12, max: 12,
  schedule: (points, start) => channelA.scheduleTrimDb(points, start),
  cancel: (from) => channelA.cancelTrimAutomation(from),
});
automation.register('channelB.trim', {
  min: -12, max: 12,
  schedule: (points, start) => channelB.scheduleTrimDb(points, start),
  cancel: (from) => channelB.cancelTrimAutomation(from),
});
automation.register('channelA.filter', {
  min: -1, max: 1,
  schedule: (points, start) => channelA.scheduleFilter(points, start),
  cancel: (from) => channelA.cancelFilterAutomation(from),
});
automation.register('channelB.filter', {
  min: -1, max: 1,
  schedule: (points, start) => channelB.scheduleFilter(points, start),
  cancel: (from) => channelB.cancelFilterAutomation(from),
});

const intelligenceResults = new Map<'A' | 'B', { fileName: string; result: TrackAnalysisResult }>();

const musicalClocks = new Map<'A' | 'B', MusicalClock>();
const pendingGrids = new Map<'A' | 'B', BeatGrid>([
  ['A', { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 }],
  ['B', { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 }],
]);

const fullscreenToggle = document.querySelector<HTMLButtonElement>('#fullscreen-toggle');
const fullscreenState = document.querySelector<HTMLSpanElement>('#fullscreen-state');

function renderFullscreenState(): void {
  const active = document.fullscreenElement != null;
  if (fullscreenToggle) fullscreenToggle.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
  if (fullscreenState) fullscreenState.textContent = active ? 'Fullscreen' : 'Windowed';
}

fullscreenToggle?.addEventListener('click', () => {
  void (document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen()
  ).catch((error: unknown) => {
    if (fullscreenState) fullscreenState.textContent = `Fullscreen unavailable: ${String(error)}`;
  });
});

document.addEventListener('fullscreenchange', renderFullscreenState);
renderFullscreenState();

const kernelStatusElement = document.querySelector<HTMLPreElement>('#status');
const activateButton = document.querySelector<HTMLButtonElement>('#activate');
const stopButton = document.querySelector<HTMLButtonElement>('#stop');
const mixerStatusElement = document.querySelector<HTMLPreElement>('#mixer-status');
const mixerMaster = document.querySelector<HTMLInputElement>('#mixer-master');
const mixerStatusButton = document.querySelector<HTMLButtonElement>('#mixer-status-button');
const mixerCrossfader = document.querySelector<HTMLInputElement>('#mixer-crossfader');
const mixerLimiter = document.querySelector<HTMLInputElement>('#mixer-limiter');
const mixerATrim = document.querySelector<HTMLInputElement>('#mixer-a-trim');
const mixerALow = document.querySelector<HTMLInputElement>('#mixer-a-low');
const mixerAMid = document.querySelector<HTMLInputElement>('#mixer-a-mid');
const mixerAHigh = document.querySelector<HTMLInputElement>('#mixer-a-high');
const mixerAFilter = document.querySelector<HTMLInputElement>('#mixer-a-filter');
const mixerBTrim = document.querySelector<HTMLInputElement>('#mixer-b-trim');
const mixerBLow = document.querySelector<HTMLInputElement>('#mixer-b-low');
const mixerBMid = document.querySelector<HTMLInputElement>('#mixer-b-mid');
const mixerBHigh = document.querySelector<HTMLInputElement>('#mixer-b-high');
const mixerBFilter = document.querySelector<HTMLInputElement>('#mixer-b-filter');
const monitorCueA = document.querySelector<HTMLInputElement>('#monitor-cue-a');
const monitorCueB = document.querySelector<HTMLInputElement>('#monitor-cue-b');
const monitorBlend = document.querySelector<HTMLInputElement>('#monitor-blend');
const monitorLevel = document.querySelector<HTMLInputElement>('#monitor-level');
const monitorEnable = document.querySelector<HTMLButtonElement>('#monitor-enable');
const monitorDisable = document.querySelector<HTMLButtonElement>('#monitor-disable');
const monitorRefreshOutputs = document.querySelector<HTMLButtonElement>('#monitor-refresh-outputs');
const monitorOutput = document.querySelector<HTMLSelectElement>('#monitor-output');
const monitorStatusButton = document.querySelector<HTMLButtonElement>('#monitor-status-button');
const monitorStatusElement = document.querySelector<HTMLPreElement>('#monitor-status');
const clockRefreshButton = document.querySelector<HTMLButtonElement>('#clock-refresh');
const syncAToBButton = document.querySelector<HTMLButtonElement>('#sync-a-to-b');
const syncBToAButton = document.querySelector<HTMLButtonElement>('#sync-b-to-a');
const syncDisableButton = document.querySelector<HTMLButtonElement>('#sync-disable');
const syncStatusButton = document.querySelector<HTMLButtonElement>('#sync-status-button');
const syncStatusElement = document.querySelector<HTMLPreElement>('#sync-status');
const perfASetCue = document.querySelector<HTMLButtonElement>('#perf-a-set-cue');
const perfACue = document.querySelector<HTMLButtonElement>('#perf-a-cue');
const perfAHot1Set = document.querySelector<HTMLButtonElement>('#perf-a-hot1-set');
const perfAHot1 = document.querySelector<HTMLButtonElement>('#perf-a-hot1');
const perfALoop = document.querySelector<HTMLButtonElement>('#perf-a-loop');
const perfALoopOff = document.querySelector<HTMLButtonElement>('#perf-a-loop-off');
const perfAJogBack = document.querySelector<HTMLButtonElement>('#perf-a-jog-back');
const perfAJogForward = document.querySelector<HTMLButtonElement>('#perf-a-jog-forward');
const perfAStatus = document.querySelector<HTMLPreElement>('#perf-a-status');
const perfBSetCue = document.querySelector<HTMLButtonElement>('#perf-b-set-cue');
const perfBCue = document.querySelector<HTMLButtonElement>('#perf-b-cue');
const perfBHot1Set = document.querySelector<HTMLButtonElement>('#perf-b-hot1-set');
const perfBHot1 = document.querySelector<HTMLButtonElement>('#perf-b-hot1');
const perfBLoop = document.querySelector<HTMLButtonElement>('#perf-b-loop');
const perfBLoopOff = document.querySelector<HTMLButtonElement>('#perf-b-loop-off');
const perfBJogBack = document.querySelector<HTMLButtonElement>('#perf-b-jog-back');
const perfBJogForward = document.querySelector<HTMLButtonElement>('#perf-b-jog-forward');
const perfBStatus = document.querySelector<HTMLPreElement>('#perf-b-status');
const intelligenceAAnalyze = document.querySelector<HTMLButtonElement>('#intelligence-a-analyze');
const intelligenceAApply = document.querySelector<HTMLButtonElement>('#intelligence-a-apply');
const intelligenceAStatus = document.querySelector<HTMLPreElement>('#intelligence-a-status');
const intelligenceBAnalyze = document.querySelector<HTMLButtonElement>('#intelligence-b-analyze');
const intelligenceBApply = document.querySelector<HTMLButtonElement>('#intelligence-b-apply');
const intelligenceBStatus = document.querySelector<HTMLPreElement>('#intelligence-b-status');
const libraryFiles = document.querySelector<HTMLInputElement>('#library-files');
const libraryImport = document.querySelector<HTMLButtonElement>('#library-import');
const libraryRefresh = document.querySelector<HTMLButtonElement>('#library-refresh');
const librarySelect = document.querySelector<HTMLSelectElement>('#library-select');
const libraryLoadA = document.querySelector<HTMLButtonElement>('#library-load-a');
const libraryLoadB = document.querySelector<HTMLButtonElement>('#library-load-b');
const libraryRemove = document.querySelector<HTMLButtonElement>('#library-remove');
const libraryStatus = document.querySelector<HTMLPreElement>('#library-status');
const librarySearch = document.querySelector<HTMLInputElement>('#library-search');
const libraryPreparedOnly = document.querySelector<HTMLInputElement>('#library-prepared-only');
const libraryMinimumRating = document.querySelector<HTMLSelectElement>('#library-min-rating');
const libraryCrateFilter = document.querySelector<HTMLSelectElement>('#library-crate-filter');
const libraryCrateName = document.querySelector<HTMLInputElement>('#library-crate-name');
const libraryCreateCrate = document.querySelector<HTMLButtonElement>('#library-create-crate');
const libraryAddCrate = document.querySelector<HTMLButtonElement>('#library-add-crate');
const libraryRemoveCrate = document.querySelector<HTMLButtonElement>('#library-remove-crate');
const libraryTitle = document.querySelector<HTMLInputElement>('#library-title');
const libraryArtist = document.querySelector<HTMLInputElement>('#library-artist');
const libraryAlbum = document.querySelector<HTMLInputElement>('#library-album');
const libraryGenre = document.querySelector<HTMLInputElement>('#library-genre');
const libraryKey = document.querySelector<HTMLInputElement>('#library-key');
const libraryTags = document.querySelector<HTMLInputElement>('#library-tags');
const libraryRating = document.querySelector<HTMLSelectElement>('#library-rating');
const libraryComment = document.querySelector<HTMLInputElement>('#library-comment');
const librarySavePrep = document.querySelector<HTMLButtonElement>('#library-save-prep');
const libraryCaptureA = document.querySelector<HTMLButtonElement>('#library-capture-a');
const libraryCaptureB = document.querySelector<HTMLButtonElement>('#library-capture-b');
const libraryClearPrep = document.querySelector<HTMLButtonElement>('#library-clear-prep');
const midiConnect = document.querySelector<HTMLButtonElement>('#midi-connect');
const midiLearnCrossfader = document.querySelector<HTMLButtonElement>('#midi-learn-crossfader');
const midiLearnMaster = document.querySelector<HTMLButtonElement>('#midi-learn-master');
const midiTargetSelect = document.querySelector<HTMLSelectElement>('#midi-target-select');
const midiInputSelect = document.querySelector<HTMLSelectElement>('#midi-input-select');
const midiLearnSelected = document.querySelector<HTMLButtonElement>('#midi-learn-selected');
const midiProfileName = document.querySelector<HTMLInputElement>('#midi-profile-name');
const midiProfileSelect = document.querySelector<HTMLSelectElement>('#midi-profile-select');
const midiProfileSave = document.querySelector<HTMLButtonElement>('#midi-profile-save');
const midiProfileActivate = document.querySelector<HTMLButtonElement>('#midi-profile-activate');
const midiProfileDelete = document.querySelector<HTMLButtonElement>('#midi-profile-delete');
const midiOutputSelect = document.querySelector<HTMLSelectElement>('#midi-output-select');
const midiFeedbackKind = document.querySelector<HTMLSelectElement>('#midi-feedback-kind');
const midiFeedbackChannel = document.querySelector<HTMLInputElement>('#midi-feedback-channel');
const midiFeedbackNumber = document.querySelector<HTMLInputElement>('#midi-feedback-number');
const midiFeedbackAdd = document.querySelector<HTMLButtonElement>('#midi-feedback-add');
const midiStatus = document.querySelector<HTMLPreElement>('#midi-status');
const recordingStart = document.querySelector<HTMLButtonElement>('#recording-start');
const recordingStop = document.querySelector<HTMLButtonElement>('#recording-stop');
const recordingStatus = document.querySelector<HTMLPreElement>('#recording-status');
const recordingDownload = document.querySelector<HTMLAnchorElement>('#recording-download');
const recordingPlayback = document.querySelector<HTMLAudioElement>('#recording-playback');
let recordingObjectUrl: string | null = null;
const automationDemo = document.querySelector<HTMLButtonElement>('#automation-demo');
const automationStatus = document.querySelector<HTMLPreElement>('#automation-status');
const waveformAOverview = document.querySelector<HTMLCanvasElement>('#waveform-a-overview');
const waveformADetail = document.querySelector<HTMLCanvasElement>('#waveform-a-detail');
const waveformBOverview = document.querySelector<HTMLCanvasElement>('#waveform-b-overview');
const waveformBDetail = document.querySelector<HTMLCanvasElement>('#waveform-b-detail');
const fxAWet = document.querySelector<HTMLInputElement>('#fx-a-wet');
const fxABeats = document.querySelector<HTMLSelectElement>('#fx-a-beats');
const fxAFeedback = document.querySelector<HTMLInputElement>('#fx-a-feedback');
const fxATone = document.querySelector<HTMLInputElement>('#fx-a-tone');
const fxBWet = document.querySelector<HTMLInputElement>('#fx-b-wet');
const fxBBeats = document.querySelector<HTMLSelectElement>('#fx-b-beats');
const fxBFeedback = document.querySelector<HTMLInputElement>('#fx-b-feedback');
const fxBTone = document.querySelector<HTMLInputElement>('#fx-b-tone');
const fxMasterWet = document.querySelector<HTMLInputElement>('#fx-master-wet');
const fxMasterBeats = document.querySelector<HTMLSelectElement>('#fx-master-beats');
const fxMasterFeedback = document.querySelector<HTMLInputElement>('#fx-master-feedback');
const fxMasterTone = document.querySelector<HTMLInputElement>('#fx-master-tone');
const fxMasterTempoSourceSelect = document.querySelector<HTMLSelectElement>('#fx-master-tempo-source');
const fxStatusButton = document.querySelector<HTMLButtonElement>('#fx-status-button');
const fxStatusElement = document.querySelector<HTMLPreElement>('#fx-status');
const samplerPadsElement = document.querySelector<HTMLDivElement>('#sampler-pads');
const samplerRestoreButton = document.querySelector<HTMLButtonElement>('#sampler-restore');
const samplerClearButton = document.querySelector<HTMLButtonElement>('#sampler-clear');
const samplerStatusButton = document.querySelector<HTMLButtonElement>('#sampler-status-button');
const samplerStatusElement = document.querySelector<HTMLPreElement>('#sampler-status');

function render(element: HTMLElement | null, value: unknown): void {
  if (element) element.textContent = JSON.stringify(value, null, 2);
}

function renderKernel(status: unknown): void {
  render(kernelStatusElement, status);
}

async function kernelStart(): Promise<AudioKernelStatus> {
  await kernel.startSignal();
  const status = await kernel.requestStatus();
  renderKernel(status);
  return status;
}

async function kernelStop(): Promise<AudioKernelStatus> {
  kernel.stopSignal();
  const status = await kernel.requestStatus();
  renderKernel(status);
  return status;
}

function bindDeck(prefix: 'a' | 'b', deck: DeckController): void {
  const statusElement = document.querySelector<HTMLPreElement>(`#deck-${prefix}-status`);
  const fileInput = document.querySelector<HTMLInputElement>(`#deck-${prefix}-file`);
  const load = document.querySelector<HTMLButtonElement>(`#deck-${prefix}-load`);
  const play = document.querySelector<HTMLButtonElement>(`#deck-${prefix}-play`);
  const pause = document.querySelector<HTMLButtonElement>(`#deck-${prefix}-pause`);
  const seek = document.querySelector<HTMLInputElement>(`#deck-${prefix}-seek`);
  const rate = document.querySelector<HTMLInputElement>(`#deck-${prefix}-rate`);
  const volume = document.querySelector<HTMLInputElement>(`#deck-${prefix}-volume`);
  const mute = document.querySelector<HTMLInputElement>(`#deck-${prefix}-mute`);

  load?.addEventListener('click', () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      render(statusElement, { error: `Choose a Deck ${prefix.toUpperCase()} audio file first.` });
      return;
    }
    void deck.loadFile(file).then((status) => {
      autoMix.recordLoad(prefix === 'a' ? 'A' : 'B', file.name);
      render(statusElement, status);
    }).catch((error: unknown) => render(statusElement, { error: String(error) }));
  });

  play?.addEventListener('click', () => {
    void deck.play().then((status) => render(statusElement, status)).catch((error: unknown) => render(statusElement, { error: String(error) }));
  });

  pause?.addEventListener('click', () => {
    void deck.pause().then((status) => render(statusElement, status)).catch((error: unknown) => render(statusElement, { error: String(error) }));
  });

  seek?.addEventListener('change', () => {
    void (async () => {
      const status = await deck.requestStatus();
      const fraction = Number(seek.value) / 1000;
      render(statusElement, await deck.seekFrame(status.sourceFrames * fraction));
    })().catch((error: unknown) => render(statusElement, { error: String(error) }));
  });

  rate?.addEventListener('change', () => {
    try {
      deck.setPlaybackRate(Number(rate.value));
    } catch (error) {
      render(statusElement, { error: String(error) });
    }
  });

  volume?.addEventListener('input', () => {
    try {
      deck.setVolume(Number(volume.value));
    } catch (error) {
      render(statusElement, { error: String(error) });
    }
  });

  mute?.addEventListener('change', () => {
    void deck.setMuted(mute.checked).then((status) => render(statusElement, status)).catch((error: unknown) => render(statusElement, { error: String(error) }));
  });
}

bindDeck('a', deckA);
bindDeck('b', deckB);

function clearIntelligenceProposal(deck: 'A' | 'B'): void {
  intelligenceResults.delete(deck);
}
document.querySelector<HTMLInputElement>('#deck-a-file')?.addEventListener('change', () => clearIntelligenceProposal('A'));
document.querySelector<HTMLInputElement>('#deck-b-file')?.addEventListener('change', () => clearIntelligenceProposal('B'));

function getDeck(deck: 'A' | 'B'): DeckController {
  return deck === 'A' ? deckA : deckB;
}

function samplerPadControls(slot: number): {
  file: HTMLInputElement | null;
  trigger: HTMLButtonElement | null;
  stop: HTMLButtonElement | null;
  load: HTMLButtonElement | null;
  mode: HTMLSelectElement | null;
  gain: HTMLInputElement | null;
  quantize: HTMLSelectElement | null;
  sourceDeck: HTMLSelectElement | null;
  label: HTMLElement | null;
} {
  return {
    file: document.querySelector<HTMLInputElement>(`#sampler-${slot}-file`),
    trigger: document.querySelector<HTMLButtonElement>(`#sampler-${slot}-trigger`),
    stop: document.querySelector<HTMLButtonElement>(`#sampler-${slot}-stop`),
    load: document.querySelector<HTMLButtonElement>(`#sampler-${slot}-load`),
    mode: document.querySelector<HTMLSelectElement>(`#sampler-${slot}-mode`),
    gain: document.querySelector<HTMLInputElement>(`#sampler-${slot}-gain`),
    quantize: document.querySelector<HTMLSelectElement>(`#sampler-${slot}-quantize`),
    sourceDeck: document.querySelector<HTMLSelectElement>(`#sampler-${slot}-source`),
    label: document.querySelector<HTMLElement>(`#sampler-${slot}-label`),
  };
}

function buildSamplerUi(): void {
  if (!samplerPadsElement) return;
  samplerPadsElement.innerHTML = Array.from({ length: 8 }, (_, index) => {
    const slot = index + 1;
    return `
      <div class="sampler-pad-card" data-slot="${slot}">
        <button id="sampler-${slot}-trigger" class="sampler-pad-trigger" type="button">
          <strong>PAD ${slot}</strong>
          <span id="sampler-${slot}-label">Empty</span>
        </button>
        <div class="row">
          <input id="sampler-${slot}-file" type="file" accept="audio/*" />
          <button id="sampler-${slot}-load" type="button">Load</button>
          <button id="sampler-${slot}-stop" type="button">Stop</button>
        </div>
        <div class="row">
          <label>Mode
            <select id="sampler-${slot}-mode">
              <option value="one-shot" selected>One-shot</option>
              <option value="loop">Loop</option>
            </select>
          </label>
          <label>Gain <input id="sampler-${slot}-gain" type="range" min="0" max="1" step="0.01" value="0.8" /></label>
        </div>
        <div class="row">
          <label>Quantize
            <select id="sampler-${slot}-quantize">
              <option value="0" selected>Off</option>
              <option value="0.25">1/4 beat</option>
              <option value="0.5">1/2 beat</option>
              <option value="1">1 beat</option>
              <option value="2">2 beats</option>
              <option value="4">4 beats</option>
            </select>
          </label>
          <label>Clock
            <select id="sampler-${slot}-source">
              <option value="A" selected>Deck A</option>
              <option value="B">Deck B</option>
            </select>
          </label>
        </div>
      </div>
    `;
  }).join('');
}

buildSamplerUi();

function configFromSamplerUi(slot: number): SamplerPadConfig {
  const controls = samplerPadControls(slot);
  return {
    mode: controls.mode?.value === 'loop' ? 'loop' : 'one-shot',
    gain: Number(controls.gain?.value ?? 0.8),
    quantizeBeats: Number(controls.quantize?.value ?? 0),
    sourceDeck: controls.sourceDeck?.value === 'B' ? 'B' : 'A',
  };
}

function syncSamplerUi(status: SamplerStatus): void {
  for (const pad of status.pads) {
    const controls = samplerPadControls(pad.slot);
    if (controls.label) controls.label.textContent = pad.loaded ? (pad.name ?? `Pad ${pad.slot}`) : 'Empty';
    if (controls.mode) controls.mode.value = pad.mode;
    if (controls.gain) controls.gain.value = String(pad.gain);
    if (controls.quantize) controls.quantize.value = String(pad.quantizeBeats);
    if (controls.sourceDeck) controls.sourceDeck.value = pad.sourceDeck;
    controls.trigger?.classList.toggle('active', pad.activeVoices > 0);
  }
}

async function renderSamplerStatus(): Promise<void> {
  const bank = await samplerBank.list();
  const status = sampler.status();
  syncSamplerUi(status);
  render(samplerStatusElement, { runtime: status, persisted: bank });
}

async function configureSamplerPad(slot: number, config: Partial<SamplerPadConfig>): Promise<SamplerPadStatus> {
  const status = sampler.configure(slot, config);
  const stored = await samplerBank.get(slot);
  if (stored) await samplerBank.updateConfig(slot, config);
  await renderSamplerStatus();
  return status;
}

async function loadSamplerFile(slot: number): Promise<SamplerPadStatus> {
  const controls = samplerPadControls(slot);
  const file = controls.file?.files?.[0];
  if (!file) throw new Error(`Choose an audio file for Pad ${slot}`);
  const config = configFromSamplerUi(slot);
  const encoded = await file.arrayBuffer();
  const status = await sampler.loadEncoded(slot, encoded, file.name, config);
  await samplerBank.saveFile(slot, file, config);
  await renderSamplerStatus();
  return status;
}

async function restoreSamplerBank(): Promise<SamplerStatus> {
  const records = await samplerBank.list();
  for (const record of records) {
    const encoded = await samplerBank.getAudio(record.slot);
    await sampler.loadEncoded(record.slot, encoded, record.name, {
      mode: record.mode,
      gain: record.gain,
      quantizeBeats: record.quantizeBeats,
      sourceDeck: record.sourceDeck,
    });
  }
  const status = sampler.status();
  syncSamplerUi(status);
  return status;
}

async function triggerSamplerPad(
  slot: number,
  overrides: { quantizeBeats?: number; sourceDeck?: 'A' | 'B' } = {},
): Promise<SamplerTriggerResult> {
  const pad = sampler.padStatus(slot);
  const quantizeBeats = overrides.quantizeBeats ?? pad.quantizeBeats;
  const sourceDeck = overrides.sourceDeck ?? pad.sourceDeck;

  if (quantizeBeats <= 0) {
    return {
      receipt: sampler.trigger(slot, runtime.context.currentTime + 0.005),
      targetSourceFrame: null,
      sourceDeck: null,
      quantizeBeats: 0,
    };
  }

  const deck = getDeck(sourceDeck);
  const deckStatus = await deck.requestStatus();
  const scheduled = quantizedSamplerStart({
    sourceFrame: deckStatus.sourceFrame,
    outputCurrentFrame: deckStatus.outputCurrentFrame,
    sampleRate: deckStatus.sampleRate,
    sourceSampleRate: deckStatus.sourceSampleRate,
    playbackRate: deckStatus.playbackRate,
    playing: deckStatus.playing,
  }, pendingGrids.get(sourceDeck)!, quantizeBeats, runtime.context.currentTime);

  return {
    receipt: sampler.trigger(slot, scheduled.scheduledContextTime),
    targetSourceFrame: scheduled.targetSourceFrame,
    sourceDeck,
    quantizeBeats,
  };
}

for (let slot = 1; slot <= 8; slot += 1) {
  const controls = samplerPadControls(slot);
  controls.load?.addEventListener('click', () => {
    void loadSamplerFile(slot).catch((error: unknown) => render(samplerStatusElement, { error: String(error) }));
  });
  controls.trigger?.addEventListener('click', () => {
    void configureSamplerPad(slot, configFromSamplerUi(slot))
      .then(() => triggerSamplerPad(slot))
      .then(() => renderSamplerStatus())
      .catch((error: unknown) => render(samplerStatusElement, { error: String(error) }));
  });
  controls.stop?.addEventListener('click', () => {
    sampler.stop(slot);
    void renderSamplerStatus();
  });
  const updateConfig = () => {
    void configureSamplerPad(slot, configFromSamplerUi(slot))
      .catch((error: unknown) => render(samplerStatusElement, { error: String(error) }));
  };
  controls.mode?.addEventListener('change', updateConfig);
  controls.gain?.addEventListener('input', updateConfig);
  controls.quantize?.addEventListener('change', updateConfig);
  controls.sourceDeck?.addEventListener('change', updateConfig);
}

samplerRestoreButton?.addEventListener('click', () => {
  void restoreSamplerBank()
    .then(() => renderSamplerStatus())
    .catch((error: unknown) => render(samplerStatusElement, { error: String(error) }));
});
samplerClearButton?.addEventListener('click', () => {
  void samplerBank.clear()
    .then(() => {
      for (let slot = 1; slot <= 8; slot += 1) sampler.unload(slot);
      return renderSamplerStatus();
    })
    .catch((error: unknown) => render(samplerStatusElement, { error: String(error) }));
});
samplerStatusButton?.addEventListener('click', () => {
  void renderSamplerStatus().catch((error: unknown) => render(samplerStatusElement, { error: String(error) }));
});

void restoreSamplerBank()
  .then(() => renderSamplerStatus())
  .catch((error: unknown) => render(samplerStatusElement, { error: String(error) }));

let masterFxTempoSource: 'A' | 'B' = 'A';

function getFx(scope: FxScope): FxUnitController {
  if (scope === 'A') return deckFxA;
  if (scope === 'B') return deckFxB;
  return masterFx;
}

async function refreshFxTempo(): Promise<{ A: number; B: number; master: number }> {
  const [aStatus, bStatus] = await Promise.all([
    deckA.requestStatus(),
    deckB.requestStatus(),
  ]);
  const aRate = aStatus.playing ? aStatus.playbackRate : deckA.requestedRate();
  const bRate = bStatus.playing ? bStatus.playbackRate : deckB.requestedRate();
  const aTempo = effectiveTempoBpm(pendingGrids.get('A')!.bpm, aRate);
  const bTempo = effectiveTempoBpm(pendingGrids.get('B')!.bpm, bRate);
  deckFxA.setTempoBpm(aTempo);
  deckFxB.setTempoBpm(bTempo);
  const masterTempo = masterFxTempoSource === 'A' ? aTempo : bTempo;
  masterFx.setTempoBpm(masterTempo);
  return { A: aTempo, B: bTempo, master: masterTempo };
}

function fxStatusSnapshot(): Record<string, FxUnitStatus | string> {
  return {
    deckA: deckFxA.status(),
    deckB: deckFxB.status(),
    master: masterFx.status(),
    masterTempoSource: masterFxTempoSource,
  };
}

function renderFxStatus(): void {
  render(fxStatusElement, fxStatusSnapshot());
}

function bindFxControls(
  scope: FxScope,
  wet: HTMLInputElement | null,
  beats: HTMLSelectElement | null,
  feedback: HTMLInputElement | null,
  tone: HTMLInputElement | null,
): void {
  wet?.addEventListener('input', () => {
    getFx(scope).setWet(Number(wet.value));
    renderFxStatus();
  });
  beats?.addEventListener('change', () => {
    getFx(scope).setBeatFraction(Number(beats.value));
    renderFxStatus();
  });
  feedback?.addEventListener('input', () => {
    getFx(scope).setFeedback(Number(feedback.value));
    renderFxStatus();
  });
  tone?.addEventListener('input', () => {
    getFx(scope).setTone(Number(tone.value));
    renderFxStatus();
  });
}

bindFxControls('A', fxAWet, fxABeats, fxAFeedback, fxATone);
bindFxControls('B', fxBWet, fxBBeats, fxBFeedback, fxBTone);
bindFxControls('master', fxMasterWet, fxMasterBeats, fxMasterFeedback, fxMasterTone);

fxMasterTempoSourceSelect?.addEventListener('change', () => {
  masterFxTempoSource = fxMasterTempoSourceSelect.value === 'B' ? 'B' : 'A';
  void refreshFxTempo().then(() => renderFxStatus()).catch((error: unknown) => render(fxStatusElement, { error: String(error) }));
});

fxStatusButton?.addEventListener('click', () => {
  void refreshFxTempo().then(() => renderFxStatus()).catch((error: unknown) => render(fxStatusElement, { error: String(error) }));
});

const fxTempoInterval = window.setInterval(() => {
  void refreshFxTempo().catch(() => {});
}, 250);

const waveformViews = new Map<'A' | 'B', WaveformTrackView>();
if (waveformAOverview && waveformADetail) waveformViews.set('A', new WaveformTrackView(waveformAOverview, waveformADetail));
if (waveformBOverview && waveformBDetail) waveformViews.set('B', new WaveformTrackView(waveformBOverview, waveformBDetail));

async function refreshWaveform(deck: 'A' | 'B'): Promise<WaveformRenderSnapshot> {
  const view = waveformViews.get(deck);
  if (!view) throw new Error(`Deck ${deck} waveform canvases are unavailable`);
  const status = await getDeck(deck).requestStatus();
  return view.render(getDeck(deck).waveform(), status, pendingGrids.get(deck)!);
}

let waveformPresentationActive = true;
let waveformRefreshPending = false;
let lastWaveformRefreshMs = 0;

function waveformPresentationFrame(timestamp: number): void {
  if (!waveformPresentationActive) return;
  if (!waveformRefreshPending && timestamp - lastWaveformRefreshMs >= 100) {
    lastWaveformRefreshMs = timestamp;
    waveformRefreshPending = true;
    void Promise.allSettled([refreshWaveform('A'), refreshWaveform('B')])
      .finally(() => { waveformRefreshPending = false; });
  }
  requestAnimationFrame(waveformPresentationFrame);
}

requestAnimationFrame(waveformPresentationFrame);

function getMusicalClock(deck: 'A' | 'B', sampleRate: number): MusicalClock {
  const existing = musicalClocks.get(deck);
  if (existing) return existing;
  const clock = new MusicalClock(sampleRate, pendingGrids.get(deck)!);
  musicalClocks.set(deck, clock);
  return clock;
}

async function musicalSnapshot(deck: 'A' | 'B'): Promise<MusicalClockSnapshot> {
  const status = await getDeck(deck).requestStatus();
  if (!status.loaded || status.sourceSampleRate <= 0) {
    throw new Error(`Deck ${deck} must have loaded PCM before musical position is available`);
  }
  const clock = getMusicalClock(deck, status.sourceSampleRate);
  return { grid: clock.getGrid(), position: clock.positionAt(status.sourceFrame) };
}

function setMusicalGrid(deck: 'A' | 'B', grid: BeatGrid): void {
  pendingGrids.set(deck, { ...grid });
  autoMix.trustGrid(deck);
  const clock = musicalClocks.get(deck);
  if (clock) clock.setGrid(grid);
  void refreshFxTempo().catch(() => {});
}

function bindClockControls(deck: 'A' | 'B', prefix: 'a' | 'b'): void {
  const bpm = document.querySelector<HTMLInputElement>(`#clock-${prefix}-bpm`)!;
  const origin = document.querySelector<HTMLInputElement>(`#clock-${prefix}-origin`)!;
  const beatsBar = document.querySelector<HTMLInputElement>(`#clock-${prefix}-beats-bar`)!;
  const apply = document.querySelector<HTMLButtonElement>(`#clock-${prefix}-apply`)!;
  const statusElement = document.querySelector<HTMLPreElement>(`#clock-${prefix}-status`);

  apply.addEventListener('click', () => {
    try {
      setMusicalGrid(deck, {
        bpm: Number(bpm.value),
        firstBeatFrame: Number(origin.value),
        beatsPerBar: Number(beatsBar.value),
        beatUnit: 4,
      });
      void musicalSnapshot(deck)
        .then((snapshot) => render(statusElement, snapshot))
        .catch((error: unknown) => render(statusElement, { grid: pendingGrids.get(deck), note: String(error) }));
    } catch (error) {
      render(statusElement, { error: String(error) });
    }
  });
}

bindClockControls('A', 'a');
bindClockControls('B', 'b');

clockRefreshButton?.addEventListener('click', () => {
  void Promise.allSettled([musicalSnapshot('A'), musicalSnapshot('B')]).then(([a, b]) => {
    render(document.querySelector('#clock-a-status'), a.status === 'fulfilled' ? a.value : { error: String(a.reason) });
    render(document.querySelector('#clock-b-status'), b.status === 'fulfilled' ? b.value : { error: String(b.reason) });
  });
});

async function analyzeSelectedTrack(deck: 'A' | 'B'): Promise<void> {
  const prefix = deck.toLowerCase();
  const fileInput = document.querySelector<HTMLInputElement>(`#deck-${prefix}-file`);
  const statusElement = deck === 'A' ? intelligenceAStatus : intelligenceBStatus;
  const file = fileInput?.files?.[0];
  if (!file) {
    render(statusElement, { error: `Choose a Deck ${deck} audio file first.` });
    return;
  }

  render(statusElement, { state: 'ANALYZING', execution: 'web-worker', file: file.name });
  const result = await intelligence.analyzeEncodedAudio(await file.arrayBuffer());
  intelligenceResults.set(deck, { fileName: file.name, result });
  render(statusElement, {
    state: 'PROPOSAL_READY',
    file: file.name,
    result,
    note: result.recommended
      ? 'Grid proposal is recommended but not applied.'
      : 'Low-confidence proposal; keep manual grid unless verified.',
  });
}

async function applyIntelligenceProposal(deck: 'A' | 'B'): Promise<void> {
  const prefix = deck.toLowerCase() as 'a' | 'b';
  const stored = intelligenceResults.get(deck);
  const statusElement = deck === 'A' ? intelligenceAStatus : intelligenceBStatus;
  const selected = document.querySelector<HTMLInputElement>(`#deck-${prefix}-file`)?.files?.[0];
  if (!stored) throw new Error(`Deck ${deck} has no analysis proposal`);
  if (!selected || selected.name !== stored.fileName) throw new Error('Selected file changed after analysis');
  if (!stored.result.recommended) throw new Error('Analysis confidence is below the automatic proposal threshold');

  const deckStatus = await getDeck(deck).requestStatus().catch(() => null);
  if (
    deckStatus?.loaded &&
    (deckStatus.sourceSampleRate !== stored.result.sampleRate ||
      deckStatus.sourceFrames !== stored.result.frameCount)
  ) {
    throw new Error('Loaded deck does not match the analyzed PCM');
  }

  const proposal = intelligence.proposal(stored.result);
  setMusicalGrid(deck, proposal.grid);

  const bpmInput = document.querySelector<HTMLInputElement>(`#clock-${prefix}-bpm`);
  const originInput = document.querySelector<HTMLInputElement>(`#clock-${prefix}-origin`);
  const beatsBarInput = document.querySelector<HTMLInputElement>(`#clock-${prefix}-beats-bar`);
  if (bpmInput) bpmInput.value = proposal.grid.bpm.toFixed(4);
  if (originInput) originInput.value = String(Math.round(proposal.grid.firstBeatFrame));
  if (beatsBarInput) beatsBarInput.value = String(proposal.grid.beatsPerBar);

  render(statusElement, { state: 'GRID_APPLIED_EXPLICITLY', proposal });
}

intelligenceAAnalyze?.addEventListener('click', () => {
  void analyzeSelectedTrack('A').catch((error: unknown) => render(intelligenceAStatus, { error: String(error) }));
});
intelligenceBAnalyze?.addEventListener('click', () => {
  void analyzeSelectedTrack('B').catch((error: unknown) => render(intelligenceBStatus, { error: String(error) }));
});
intelligenceAApply?.addEventListener('click', () => {
  void applyIntelligenceProposal('A').catch((error: unknown) => render(intelligenceAStatus, { error: String(error) }));
});
intelligenceBApply?.addEventListener('click', () => {
  void applyIntelligenceProposal('B').catch((error: unknown) => render(intelligenceBStatus, { error: String(error) }));
});

async function enableSyncFromUi(leader: DeckId): Promise<void> {
  const follower: DeckId = leader === 'A' ? 'B' : 'A';
  const leaderGrid = pendingGrids.get(leader)!;
  const followerGrid = pendingGrids.get(follower)!;
  const result = await sync.enable(leader, leaderGrid, followerGrid);
  render(syncStatusElement, result);
}

perfASetCue?.addEventListener('click', () => {
  void performanceA.setCueHere().then((s) => render(perfAStatus, s)).catch((e: unknown) => render(perfAStatus, { error: String(e) }));
});
perfACue?.addEventListener('click', () => {
  void performanceA.triggerCue(true).then((s) => render(perfAStatus, s)).catch((e: unknown) => render(perfAStatus, { error: String(e) }));
});
perfAHot1Set?.addEventListener('click', () => {
  void performanceA.setHotCueHere(1).then((s) => render(perfAStatus, s)).catch((e: unknown) => render(perfAStatus, { error: String(e) }));
});
perfAHot1?.addEventListener('click', () => {
  void performanceA.triggerHotCue(1).then((s) => render(perfAStatus, s)).catch((e: unknown) => render(perfAStatus, { error: String(e) }));
});
perfALoop?.addEventListener('click', () => {
  void (async () => {
    const snap = await musicalSnapshot('A');
    const startBeat = Math.floor(snap.position.beatPosition);
    render(perfAStatus, await performanceA.setBeatLoop(pendingGrids.get('A')!, startBeat, 4));
  })().catch((e: unknown) => render(perfAStatus, { error: String(e) }));
});
perfALoopOff?.addEventListener('click', () => {
  void performanceA.setLoopEnabled(false).then((s) => render(perfAStatus, s)).catch((e: unknown) => render(perfAStatus, { error: String(e) }));
});
perfAJogBack?.addEventListener('click', () => {
  void performanceA.jogBySeconds(-0.05).then((s) => render(perfAStatus, s)).catch((e: unknown) => render(perfAStatus, { error: String(e) }));
});
perfAJogForward?.addEventListener('click', () => {
  void performanceA.jogBySeconds(0.05).then((s) => render(perfAStatus, s)).catch((e: unknown) => render(perfAStatus, { error: String(e) }));
});

perfBSetCue?.addEventListener('click', () => {
  void performanceB.setCueHere().then((s) => render(perfBStatus, s)).catch((e: unknown) => render(perfBStatus, { error: String(e) }));
});
perfBCue?.addEventListener('click', () => {
  void performanceB.triggerCue(true).then((s) => render(perfBStatus, s)).catch((e: unknown) => render(perfBStatus, { error: String(e) }));
});
perfBHot1Set?.addEventListener('click', () => {
  void performanceB.setHotCueHere(1).then((s) => render(perfBStatus, s)).catch((e: unknown) => render(perfBStatus, { error: String(e) }));
});
perfBHot1?.addEventListener('click', () => {
  void performanceB.triggerHotCue(1).then((s) => render(perfBStatus, s)).catch((e: unknown) => render(perfBStatus, { error: String(e) }));
});
perfBLoop?.addEventListener('click', () => {
  void (async () => {
    const snap = await musicalSnapshot('B');
    const startBeat = Math.floor(snap.position.beatPosition);
    render(perfBStatus, await performanceB.setBeatLoop(pendingGrids.get('B')!, startBeat, 4));
  })().catch((e: unknown) => render(perfBStatus, { error: String(e) }));
});
perfBLoopOff?.addEventListener('click', () => {
  void performanceB.setLoopEnabled(false).then((s) => render(perfBStatus, s)).catch((e: unknown) => render(perfBStatus, { error: String(e) }));
});
perfBJogBack?.addEventListener('click', () => {
  void performanceB.jogBySeconds(-0.05).then((s) => render(perfBStatus, s)).catch((e: unknown) => render(perfBStatus, { error: String(e) }));
});
perfBJogForward?.addEventListener('click', () => {
  void performanceB.jogBySeconds(0.05).then((s) => render(perfBStatus, s)).catch((e: unknown) => render(perfBStatus, { error: String(e) }));
});

syncAToBButton?.addEventListener('click', () => {
  void enableSyncFromUi('A').catch((error: unknown) => render(syncStatusElement, { error: String(error) }));
});
syncBToAButton?.addEventListener('click', () => {
  void enableSyncFromUi('B').catch((error: unknown) => render(syncStatusElement, { error: String(error) }));
});
syncDisableButton?.addEventListener('click', () => {
  void sync.disable().then(() => render(syncStatusElement, { enabled: false })).catch((error: unknown) => render(syncStatusElement, { error: String(error) }));
});
syncStatusButton?.addEventListener('click', () => {
  void sync.status().then((status) => render(syncStatusElement, status)).catch((error: unknown) => render(syncStatusElement, { error: String(error) }));
});

activateButton?.addEventListener('click', () => {
  void kernelStart().catch((error: unknown) => renderKernel({ error: String(error) }));
});
stopButton?.addEventListener('click', () => {
  void kernelStop().catch((error: unknown) => renderKernel({ error: String(error) }));
});
mixerMaster?.addEventListener('input', () => {
  try {
    mixer.setMasterVolume(Number(mixerMaster.value));
  } catch (error) {
    render(mixerStatusElement, { error: String(error) });
  }
});
mixerCrossfader?.addEventListener('input', () => {
  try {
    autoMix.manualOverride(Number(mixerCrossfader.value));
  } catch (error) {
    render(mixerStatusElement, { error: String(error) });
  }
});
mixerLimiter?.addEventListener('input', () => {
  try {
    mixer.setLimiterThreshold(Number(mixerLimiter.value));
  } catch (error) {
    render(mixerStatusElement, { error: String(error) });
  }
});

function bindChannelDsp(
  strip: ChannelStripController,
  controls: {
    trim: HTMLInputElement | null;
    low: HTMLInputElement | null;
    mid: HTMLInputElement | null;
    high: HTMLInputElement | null;
    filter: HTMLInputElement | null;
  },
): void {
  controls.trim?.addEventListener('input', () => strip.setTrimDb(Number(controls.trim!.value)));
  controls.low?.addEventListener('input', () => strip.setEqDb('low', Number(controls.low!.value)));
  controls.mid?.addEventListener('input', () => strip.setEqDb('mid', Number(controls.mid!.value)));
  controls.high?.addEventListener('input', () => strip.setEqDb('high', Number(controls.high!.value)));
  controls.filter?.addEventListener('input', () => strip.setFilter(Number(controls.filter!.value)));
}

bindChannelDsp(channelA, {
  trim: mixerATrim,
  low: mixerALow,
  mid: mixerAMid,
  high: mixerAHigh,
  filter: mixerAFilter,
});
bindChannelDsp(channelB, {
  trim: mixerBTrim,
  low: mixerBLow,
  mid: mixerBMid,
  high: mixerBHigh,
  filter: mixerBFilter,
});

mixerStatusButton?.addEventListener('click', () => {
  void mixer.requestStatus()
    .then((status) => render(mixerStatusElement, {
      mixer: status,
      channelA: channelA.status(),
      channelB: channelB.status(),
    }))
    .catch((error: unknown) => render(mixerStatusElement, { error: String(error) }));
});

function renderMonitorStatus(status = monitor.status()): void {
  render(monitorStatusElement, status);
}

async function refreshMonitorOutputsUi(): Promise<void> {
  const outputs = await monitor.listOutputDevices();
  if (monitorOutput) {
    const current = monitorOutput.value;
    monitorOutput.replaceChildren(...outputs.map((device) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label;
      return option;
    }));
    if (outputs.some((device) => device.deviceId === current)) monitorOutput.value = current;
  }
  renderMonitorStatus();
}

monitorCueA?.addEventListener('change', () => {
  monitor.setCue('A', monitorCueA.checked);
  renderMonitorStatus();
});
monitorCueB?.addEventListener('change', () => {
  monitor.setCue('B', monitorCueB.checked);
  renderMonitorStatus();
});
monitorBlend?.addEventListener('input', () => {
  monitor.setBlend(Number(monitorBlend.value));
  renderMonitorStatus();
});
monitorLevel?.addEventListener('input', () => {
  monitor.setLevel(Number(monitorLevel.value));
  renderMonitorStatus();
});
monitorEnable?.addEventListener('click', () => {
  void monitor.enableOutput()
    .then(renderMonitorStatus)
    .catch((error: unknown) => render(monitorStatusElement, { error: String(error) }));
});
monitorDisable?.addEventListener('click', () => renderMonitorStatus(monitor.disableOutput()));
monitorRefreshOutputs?.addEventListener('click', () => {
  void refreshMonitorOutputsUi()
    .catch((error: unknown) => render(monitorStatusElement, { error: String(error) }));
});
monitorOutput?.addEventListener('change', () => {
  if (!monitorOutput.value) return;
  void monitor.setOutputDevice(monitorOutput.value)
    .then(renderMonitorStatus)
    .catch((error: unknown) => render(monitorStatusElement, { error: String(error) }));
});
monitorStatusButton?.addEventListener('click', () => renderMonitorStatus());

function performanceForDeck(deck: 'A' | 'B'): PerformanceTransportController {
  return deck === 'A' ? performanceA : performanceB;
}

function currentLibraryQuery(crate: LibraryCrate | null): LibraryQuery {
  return {
    text: librarySearch?.value ?? '',
    preparedOnly: Boolean(libraryPreparedOnly?.checked),
    minimumRating: Number(libraryMinimumRating?.value ?? 0),
    ...(crate ? { crateTrackIds: crate.trackIds } : {}),
  };
}

function preparationFromEditor(track: LibraryTrack): Partial<LibraryTrackPreparation> {
  return {
    metadata: {
      title: libraryTitle?.value.trim() || track.preparation?.metadata.title || defaultTrackMetadata(track.name).title,
      artist: libraryArtist?.value.trim() ?? '',
      album: libraryAlbum?.value.trim() ?? '',
      genre: libraryGenre?.value.trim() ?? '',
      key: libraryKey?.value.trim() ?? '',
      comment: libraryComment?.value.trim() ?? '',
    },
    rating: Number(libraryRating?.value ?? 0),
    tags: (libraryTags?.value ?? '').split(','),
  };
}

function fillPreparationEditor(track: LibraryTrack | null): void {
  const metadata = track?.preparation?.metadata ?? (track ? defaultTrackMetadata(track.name) : defaultTrackMetadata(''));
  if (libraryTitle) libraryTitle.value = metadata.title;
  if (libraryArtist) libraryArtist.value = metadata.artist;
  if (libraryAlbum) libraryAlbum.value = metadata.album;
  if (libraryGenre) libraryGenre.value = metadata.genre;
  if (libraryKey) libraryKey.value = metadata.key;
  if (libraryTags) libraryTags.value = track?.preparation?.tags.join(', ') ?? '';
  if (libraryRating) libraryRating.value = String(track?.preparation?.rating ?? 0);
  if (libraryComment) libraryComment.value = metadata.comment;
}

async function selectedLibraryCrate(): Promise<LibraryCrate | null> {
  const crateId = libraryCrateFilter?.value;
  if (!crateId) return null;
  return library.getCrate(crateId);
}

async function selectedLibraryTrack(): Promise<LibraryTrack> {
  const id = librarySelect?.value;
  if (!id) throw new Error('Choose a library track');
  const track = await library.get(id);
  if (!track) throw new Error('Selected library track no longer exists');
  return track;
}

async function refreshLibraryUi(): Promise<void> {
  const [crates, crate] = await Promise.all([
    library.listCrates(),
    selectedLibraryCrate().catch(() => null),
  ]);
  const tracks = await library.search(currentLibraryQuery(crate));

  if (libraryCrateFilter) {
    const current = libraryCrateFilter.value;
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'All tracks';
    const options = crates.map((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.trackIds.length})`;
      return option;
    });
    libraryCrateFilter.replaceChildren(all, ...options);
    if (crates.some((item) => item.id === current)) libraryCrateFilter.value = current;
  }

  if (librarySelect) {
    const current = librarySelect.value;
    librarySelect.replaceChildren(...tracks.map((track) => {
      const option = document.createElement('option');
      option.value = track.id;
      const prep = track.preparation;
      const title = prep?.metadata.title || track.name;
      const artist = prep?.metadata.artist ? ` — ${prep.metadata.artist}` : '';
      const bpm = prep?.grid?.bpm ? ` · ${prep.grid.bpm.toFixed(1)} BPM` : '';
      const stars = prep?.rating ? ` · ${'★'.repeat(prep.rating)}` : '';
      option.textContent = `${title}${artist}${bpm}${stars}`;
      return option;
    }));
    if (tracks.some((track) => track.id === current)) librarySelect.value = current;
    else if (tracks[0]) librarySelect.value = tracks[0].id;
  }

  const selected = librarySelect?.value ? await library.get(librarySelect.value) : null;
  fillPreparationEditor(selected);
  render(libraryStatus, {
    count: tracks.length,
    totalCount: (await library.list()).length,
    crate,
    crates,
    selected,
    tracks,
  });
}

async function captureLibraryPreparation(id: string, deck: 'A' | 'B'): Promise<LibraryTrack> {
  const status = await getDeck(deck).requestStatus();
  if (!status.loaded) throw new Error(`Deck ${deck} must have a loaded track before capture`);
  const existing = await library.get(id);
  if (!existing) throw new Error('Library track not found');
  return library.updatePreparation(id, {
    ...preparationFromEditor(existing),
    grid: { ...pendingGrids.get(deck)! },
    cueFrame: status.cueFrame,
    hotCues: [...status.hotCues],
    loop: status.loopStartFrame !== null && status.loopEndFrame !== null
      ? {
          startFrame: status.loopStartFrame,
          endFrame: status.loopEndFrame,
          enabled: status.loopEnabled,
        }
      : null,
  });
}

async function applyLibraryPreparation(deck: 'A' | 'B', track: LibraryTrack): Promise<DeckStatus> {
  const prep = track.preparation;
  if (!prep) return getDeck(deck).requestStatus();
  if (prep.grid) setMusicalGrid(deck, prep.grid);

  const performance = performanceForDeck(deck);
  if (prep.cueFrame !== undefined && prep.cueFrame !== null) {
    await performance.setCueAtFrame(prep.cueFrame);
  }
  for (let slot = 1; slot <= 8; slot += 1) {
    const frame = prep.hotCues?.[slot - 1];
    if (frame !== undefined && frame !== null) await performance.setHotCue(slot, frame);
  }
  if (prep.loop) {
    await performance.setLoopFrames(prep.loop.startFrame, prep.loop.endFrame);
    if (!prep.loop.enabled) await performance.setLoopEnabled(false);
  }
  return getDeck(deck).requestStatus();
}

async function loadLibraryTrackById(id: string, deck: 'A' | 'B'): Promise<DeckStatus> {
  const track = await library.get(id);
  if (!track) throw new Error('Library track not found');
  const encoded = await library.getAudio(id);
  await getDeck(deck).loadEncodedAudio(encoded);
  autoMix.recordLoad(deck, track.id);
  return applyLibraryPreparation(deck, track);
}

async function loadLibraryTrack(deck: 'A' | 'B'): Promise<DeckStatus> {
  const id = librarySelect?.value;
  if (!id) throw new Error('Choose a library track');
  return loadLibraryTrackById(id, deck);
}

libraryImport?.addEventListener('click', () => {
  void (async () => {
    const files = [...(libraryFiles?.files ?? [])];
    if (files.length === 0) throw new Error('Choose one or more audio files');
    for (const file of files) await library.importFile(file);
    await refreshLibraryUi();
  })().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryRefresh?.addEventListener('click', () => {
  void refreshLibraryUi().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
librarySearch?.addEventListener('input', () => {
  void refreshLibraryUi().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryPreparedOnly?.addEventListener('change', () => {
  void refreshLibraryUi().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryMinimumRating?.addEventListener('change', () => {
  void refreshLibraryUi().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryCrateFilter?.addEventListener('change', () => {
  void refreshLibraryUi().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
librarySelect?.addEventListener('change', () => {
  void selectedLibraryTrack()
    .then(fillPreparationEditor)
    .catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryCreateCrate?.addEventListener('click', () => {
  void library.createCrate(libraryCrateName?.value ?? '')
    .then((crate) => {
      if (libraryCrateFilter) libraryCrateFilter.value = crate.id;
      return refreshLibraryUi();
    })
    .catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryAddCrate?.addEventListener('click', () => {
  void (async () => {
    const crateId = libraryCrateFilter?.value;
    const trackId = librarySelect?.value;
    if (!crateId || !trackId) throw new Error('Choose both a crate and a track');
    await library.addToCrate(crateId, trackId);
    await refreshLibraryUi();
  })().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryRemoveCrate?.addEventListener('click', () => {
  void (async () => {
    const crateId = libraryCrateFilter?.value;
    const trackId = librarySelect?.value;
    if (!crateId || !trackId) throw new Error('Choose both a crate and a track');
    await library.removeFromCrate(crateId, trackId);
    await refreshLibraryUi();
  })().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
librarySavePrep?.addEventListener('click', () => {
  void (async () => {
    const track = await selectedLibraryTrack();
    await library.updatePreparation(track.id, preparationFromEditor(track));
    await refreshLibraryUi();
  })().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryCaptureA?.addEventListener('click', () => {
  void selectedLibraryTrack()
    .then((track) => captureLibraryPreparation(track.id, 'A'))
    .then(() => refreshLibraryUi())
    .catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryCaptureB?.addEventListener('click', () => {
  void selectedLibraryTrack()
    .then((track) => captureLibraryPreparation(track.id, 'B'))
    .then(() => refreshLibraryUi())
    .catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryClearPrep?.addEventListener('click', () => {
  void selectedLibraryTrack()
    .then((track) => library.clearPreparation(track.id))
    .then(() => refreshLibraryUi())
    .catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryLoadA?.addEventListener('click', () => {
  void loadLibraryTrack('A').then((status) => render(document.querySelector('#deck-a-status'), status))
    .catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryLoadB?.addEventListener('click', () => {
  void loadLibraryTrack('B').then((status) => render(document.querySelector('#deck-b-status'), status))
    .catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});
libraryRemove?.addEventListener('click', () => {
  void (async () => {
    const id = librarySelect?.value;
    if (!id) throw new Error('Choose a library track');
    await library.remove(id);
    await refreshLibraryUi();
  })().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
});

function refreshMidiUi(): void {
  const status = webMidi.status();
  if (midiTargetSelect) {
    const current = midiTargetSelect.value;
    midiTargetSelect.replaceChildren(...MIDI_TARGETS.map((descriptor) => {
      const option = document.createElement('option');
      option.value = descriptor.target;
      option.textContent = descriptor.label;
      return option;
    }));
    if (MIDI_TARGETS.some((descriptor) => descriptor.target === current)) midiTargetSelect.value = current;
  }

  if (midiInputSelect) {
    const current = midiInputSelect.value;
    const any = document.createElement('option');
    any.value = '';
    any.textContent = 'Any input';
    const source = document.createElement('option');
    source.value = '__source__';
    source.textContent = 'Learn source device';
    const inputs = status.inputs.map((input) => {
      const option = document.createElement('option');
      option.value = input.id;
      option.textContent = input.name || input.id;
      return option;
    });
    midiInputSelect.replaceChildren(any, source, ...inputs);
    if ([...midiInputSelect.options].some((option) => option.value === current)) midiInputSelect.value = current;
  }

  if (midiOutputSelect) {
    const current = midiOutputSelect.value;
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'All MIDI outputs';
    const outputs = status.outputs.map((output) => {
      const option = document.createElement('option');
      option.value = output.id;
      option.textContent = output.name || output.id;
      return option;
    });
    midiOutputSelect.replaceChildren(all, ...outputs);
    if ([...midiOutputSelect.options].some((option) => option.value === current)) midiOutputSelect.value = current;
  }

  if (midiProfileSelect) {
    const activeId = midiProfiles.active()?.id ?? '';
    const current = midiProfileSelect.value || activeId;
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'No active profile';
    const profiles = midiProfiles.list().map((profile) => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      return option;
    });
    midiProfileSelect.replaceChildren(none, ...profiles);
    midiProfileSelect.value = [...midiProfileSelect.options].some((option) => option.value === current) ? current : '';
  }

  render(midiStatus, {
    ...status,
    activeProfile: midiProfiles.active(),
    feedback: midiFeedback.listBindings(),
    recentFeedback: midiFeedbackLog.slice(-12),
  });
}

midiConnect?.addEventListener('click', () => {
  void webMidi.connect()
    .then(() => refreshMidiUi())
    .catch((error: unknown) => render(midiStatus, { error: String(error), status: webMidi.status() }));
});

midiLearnCrossfader?.addEventListener('click', () => {
  midiEngine.startLearn('mixer.crossfader', 'absolute', -1, 1);
  refreshMidiUi();
});
midiLearnMaster?.addEventListener('click', () => {
  midiEngine.startLearn('mixer.master', 'absolute', 0, 1);
  refreshMidiUi();
});

midiLearnSelected?.addEventListener('click', () => {
  const descriptor = midiTarget(midiTargetSelect?.value ?? '');
  if (!descriptor) {
    render(midiStatus, { error: 'Choose a MIDI target' });
    return;
  }
  const selectedInput = midiInputSelect?.value ?? '';
  const inputId = selectedInput === '__source__'
    ? 'source'
    : selectedInput || undefined;
  midiEngine.startLearn(descriptor.target, descriptor.mode, descriptor.min, descriptor.max, inputId);
  render(midiStatus, {
    ...webMidi.status(),
    learning: descriptor,
    input: inputId ?? 'any',
  });
});

midiProfileSave?.addEventListener('click', () => {
  try {
    const selected = midiProfileSelect?.value || undefined;
    const profile = midiProfiles.save({
      ...(selected ? { id: selected } : {}),
      name: midiProfileName?.value || midiProfiles.get(selected ?? '')?.name || 'Controller Profile',
      bindings: midiEngine.listBindings(),
      feedback: midiFeedback.listBindings(),
    });
    midiProfiles.activate(profile.id);
    refreshMidiUi();
  } catch (error) {
    render(midiStatus, { error: String(error) });
  }
});

midiProfileActivate?.addEventListener('click', () => {
  try {
    const id = midiProfileSelect?.value || null;
    applyMidiProfile(midiProfiles.activate(id));
    refreshMidiUi();
  } catch (error) {
    render(midiStatus, { error: String(error) });
  }
});

midiProfileDelete?.addEventListener('click', () => {
  const id = midiProfileSelect?.value;
  if (!id) return;
  midiProfiles.remove(id);
  applyMidiProfile(midiProfiles.active());
  refreshMidiUi();
});

midiFeedbackAdd?.addEventListener('click', () => {
  const descriptor = midiTarget(midiTargetSelect?.value ?? '');
  if (!descriptor) {
    render(midiStatus, { error: 'Choose a target before adding feedback' });
    return;
  }
  try {
    const channel = Number(midiFeedbackChannel?.value ?? 1);
    const number = Number(midiFeedbackNumber?.value ?? 0);
    const outputId = midiOutputSelect?.value || undefined;
    const binding: MidiFeedbackBinding = {
      id: `feedback:${descriptor.target}:${channel}:${number}:${Date.now()}`,
      target: descriptor.target,
      kind: midiFeedbackKind?.value === 'cc' ? 'cc' : 'note',
      channel,
      number,
      mode: descriptor.mode === 'trigger' ? 'pulse' : 'scaled',
      ...(descriptor.min === undefined ? {} : { min: descriptor.min }),
      ...(descriptor.max === undefined ? {} : { max: descriptor.max }),
      ...(outputId === undefined ? {} : { outputId }),
    };
    midiFeedback.replaceBindings([...midiFeedback.listBindings(), binding]);
    refreshMidiUi();
  } catch (error) {
    render(midiStatus, { error: String(error) });
  }
});

recordingStart?.addEventListener('click', () => {
  try {
    render(recordingStatus, recording.start());
  } catch (error) {
    render(recordingStatus, { error: String(error) });
  }
});
recordingStop?.addEventListener('click', () => {
  void recording.stop()
    .then(({ status, blob }) => {
      render(recordingStatus, status);
      if (recordingObjectUrl) URL.revokeObjectURL(recordingObjectUrl);
      recordingObjectUrl = URL.createObjectURL(blob);
      if (recordingDownload) {
        recordingDownload.href = recordingObjectUrl;
        recordingDownload.download = `libertas0-mix-${Date.now()}.webm`;
        recordingDownload.hidden = false;
      }
      if (recordingPlayback) {
        recordingPlayback.src = recordingObjectUrl;
        recordingPlayback.hidden = false;
        recordingPlayback.load();
      }
    })
    .catch((error: unknown) => render(recordingStatus, { error: String(error) }));
});

automationDemo?.addEventListener('click', () => {
  try {
    render(automationStatus, automation.schedule({
      target: 'mixer.crossfader',
      points: [
        { offsetSeconds: 0, value: -1 },
        { offsetSeconds: 2, value: 0 },
        { offsetSeconds: 4, value: 1 },
      ],
    }, 0.1));
  } catch (error) {
    render(automationStatus, { error: String(error) });
  }
});

void refreshLibraryUi().catch((error: unknown) => render(libraryStatus, { error: String(error) }));
refreshMidiUi();
render(recordingStatus, recording.status());
render(automationStatus, { targets: automation.targetsList(), state: 'idle' });

function blockMainThread(milliseconds: number): void {
  const end = performance.now() + milliseconds;
  while (performance.now() < end) {
    // Deliberate UI/main-thread stall for realtime proof.
  }
}

function makeDeckTestApi(deck: DeckController, defaultFrequencyHz: number): LibertasDeckTestApi {
  return {
    async loadGeneratedTone(durationSeconds = 10, frequencyHz = defaultFrequencyHz, amplitude = 0.35) {
      const result = await deck.loadEncodedAudio(createSineWav({
        durationSeconds,
        sampleRate: 48_000,
        frequencyHz,
        amplitude,
      }));
      autoMix.recordLoad(deck === deckA ? 'A' : 'B', 'generated-tone');
      return result;
    },
    play: () => deck.play(),
    pause: () => deck.pause(),
    seekFrame: (frame) => deck.seekFrame(frame),
    setRate: (rate) => deck.setPlaybackRate(rate),
    setVolume: (volume) => deck.setVolume(volume),
    setMuted: (muted) => deck.setMuted(muted),
    status: () => deck.requestStatus(),
    rms: () => deck.measureRms(),
    blockMainThread,
    close: () => deck.close(),
  };
}

window.__libertasKernelTest = {
  start: kernelStart,
  stop: kernelStop,
  status: () => kernel.requestStatus(),
  close: async () => {
    await kernel.close();
    monitor.close();
    await deckA.close();
    await deckB.close();
    channelA.close();
    channelB.close();
    await mixer.close();
    await runtime.close();
  },
  capabilities: detectAudioKernelCapabilities,
  blockMainThread,
};

window.__libertasDeckATest = makeDeckTestApi(deckA, 330);
window.__libertasDeckBTest = makeDeckTestApi(deckB, 550);

function channelStrip(deck: 'A' | 'B'): ChannelStripController {
  return deck === 'A' ? channelA : channelB;
}

window.__libertasMixerTest = {
  status: () => mixer.requestStatus(),
  setMasterVolume: (volume) => mixer.setMasterVolume(volume),
  setCrossfader: (position) => mixer.setCrossfader(position),
  setLimiterThreshold: (threshold) => mixer.setLimiterThreshold(threshold),
  setChannelTrim: (deck, db) => channelStrip(deck).setTrimDb(db),
  setChannelEq: (deck, band, db) => channelStrip(deck).setEqDb(band, db),
  setChannelFilter: (deck, position) => channelStrip(deck).setFilter(position),
  channelStatus: (deck) => channelStrip(deck).status(),
  channelRms: (deck) => channelStrip(deck).measureRms(),
  rms: () => mixer.measureRms(),
};

window.__libertasMonitorCueTest = {
  setCue: (deck, enabled) => monitor.setCue(deck, enabled),
  setBlend: (position) => monitor.setBlend(position),
  setLevel: (level) => monitor.setLevel(level),
  enableOutput: () => monitor.enableOutput(),
  disableOutput: () => monitor.disableOutput(),
  status: () => monitor.status(),
  listOutputs: () => monitor.listOutputDevices(),
  setOutputDevice: (deviceId) => monitor.setOutputDevice(deviceId),
};

window.__libertasWaveformTest = {
  refresh: (deck) => refreshWaveform(deck),
  snapshot: (deck) => {
    const view = waveformViews.get(deck);
    if (!view) throw new Error(`Deck ${deck} waveform view is unavailable`);
    return view.snapshot();
  },
  envelope: (deck) => {
    const envelope = getDeck(deck).waveform();
    return envelope
      ? { buckets: envelope.buckets, sourceFrames: envelope.sourceFrames, sampleRate: envelope.sampleRate }
      : null;
  },
};

window.__libertasFxTest = {
  setWet: (scope, wet) => getFx(scope).setWet(wet),
  setBeatFraction: (scope, beats) => getFx(scope).setBeatFraction(beats),
  setFeedback: (scope, feedback) => getFx(scope).setFeedback(feedback),
  setTone: (scope, tone) => getFx(scope).setTone(tone),
  setMasterTempoSource(deck) {
    masterFxTempoSource = deck;
  },
  refreshTempo: () => refreshFxTempo(),
  status: (scope) => getFx(scope).status(),
};

window.__libertasSamplerTest = {
  async clear() {
    await samplerBank.clear();
    for (let slot = 1; slot <= 8; slot += 1) sampler.unload(slot);
    return renderSamplerStatus();
  },
  async loadGenerated(slot, durationSeconds = 2, frequencyHz = 880, config = {}) {
    const encoded = createSineWav({
      durationSeconds,
      sampleRate: 48_000,
      frequencyHz,
      amplitude: 0.25,
      channels: 2,
    });
    const nextConfig: SamplerPadConfig = {
      mode: config.mode ?? 'one-shot',
      gain: config.gain ?? 0.8,
      quantizeBeats: config.quantizeBeats ?? 0,
      sourceDeck: config.sourceDeck ?? 'A',
    };
    const status = await sampler.loadEncoded(slot, encoded, `generated-pad-${slot}.wav`, nextConfig);
    await samplerBank.saveBlob(
      slot,
      `generated-pad-${slot}.wav`,
      new Blob([encoded], { type: 'audio/wav' }),
      nextConfig,
    );
    return status;
  },
  configure: (slot, config) => configureSamplerPad(slot, config),
  trigger: (slot, options = {}) => triggerSamplerPad(slot, options),
  stop: (slot) => sampler.stop(slot),
  status: () => sampler.status(),
  listBank: () => samplerBank.list(),
  unloadRuntime: (slot) => sampler.unload(slot),
  restore: () => restoreSamplerBank(),
};

window.__libertasMusicalClockTest = {
  setGrid: setMusicalGrid,
  snapshot: musicalSnapshot,
  async snapshotBoth() {
    const [a, b] = await Promise.all([musicalSnapshot('A'), musicalSnapshot('B')]);
    return { a, b };
  },
  quantize(deck, sourceFrame, quantumBeats = 1, direction = 'nearest') {
    const clock = musicalClocks.get(deck);
    if (!clock) throw new Error(`Deck ${deck} musical clock is not initialized; load PCM and request a snapshot first`);
    return clock.quantize(sourceFrame, quantumBeats, direction);
  },
};

window.__libertasSyncTest = {
  async loadClickPair(durationSeconds = 20, bpmA = 120, bpmB = 128) {
    const [a, b] = await Promise.all([
      deckA.loadEncodedAudio(createClickTrackWav({ durationSeconds, sampleRate: 48_000, bpm: bpmA, amplitude: 0.45 })),
      deckB.loadEncodedAudio(createClickTrackWav({ durationSeconds, sampleRate: 48_000, bpm: bpmB, amplitude: 0.45 })),
    ]);
    autoMix.recordLoad('A', 'click-fixture-A');
    autoMix.recordLoad('B', 'click-fixture-B');
    setMusicalGrid('A', { bpm: bpmA, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 });
    setMusicalGrid('B', { bpm: bpmB, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 });
    return { a, b };
  },
  enable(leader, options = {}) {
    const follower: DeckId = leader === 'A' ? 'B' : 'A';
    return sync.enable(
      leader,
      pendingGrids.get(leader)!,
      pendingGrids.get(follower)!,
      { ...DEFAULT_SYNC_OPTIONS, ...options },
    );
  },
  disable: () => sync.disable(),
  status: () => sync.status(),
};

function makePerformanceTestApi(
  controller: PerformanceTransportController,
  deck: 'A' | 'B',
): LibertasPerformanceTransportTestApi {
  return {
    setCueHere: () => controller.setCueHere(),
    setCueFrame: (frame) => controller.setCueAtFrame(frame),
    triggerCue: (pause = true) => controller.triggerCue(pause),
    setHotCueHere: (slot) => controller.setHotCueHere(slot),
    setHotCue: (slot, frame) => controller.setHotCue(slot, frame),
    triggerHotCue: (slot) => controller.triggerHotCue(slot),
    clearHotCue: (slot) => controller.clearHotCue(slot),
    setLoopFrames: (startFrame, endFrame) => controller.setLoopFrames(startFrame, endFrame),
    setBeatLoop: (startBeat, lengthBeats) =>
      controller.setBeatLoop(pendingGrids.get(deck)!, startBeat, lengthBeats),
    setLoopEnabled: (enabled) => controller.setLoopEnabled(enabled),
    clearLoop: () => controller.clearLoop(),
    jogByFrames: (deltaFrames) => controller.jogByFrames(deltaFrames),
    jogBySeconds: (deltaSeconds) => controller.jogBySeconds(deltaSeconds),
  };
}

window.__libertasPerformanceATest = makePerformanceTestApi(performanceA, 'A');
window.__libertasPerformanceBTest = makePerformanceTestApi(performanceB, 'B');

window.__libertasIntelligenceTest = {
  workerAvailable: () => intelligence.workerAvailable(),
  analyzeClick(options = {}) {
    return intelligence.analyzeEncodedAudio(createClickTrackWav({
      durationSeconds: options.durationSeconds ?? 20,
      bpm: options.bpm ?? 120,
      sampleRate: options.sampleRate ?? 48_000,
      firstBeatOffsetSeconds: options.firstBeatOffsetSeconds ?? 0,
      amplitude: 0.45,
    }));
  },
  async loadClick(deck, options = {}) {
    const loaded = await getDeck(deck).loadEncodedAudio(createClickTrackWav({
      durationSeconds: options.durationSeconds ?? 20,
      bpm: options.bpm ?? 120,
      sampleRate: options.sampleRate ?? 48_000,
      firstBeatOffsetSeconds: options.firstBeatOffsetSeconds ?? 0,
      amplitude: 0.45,
    }));
    autoMix.recordLoad(deck, 'intelligence-click');
    return loaded;
  },
  apply(deck, result) {
    const proposal = intelligence.proposal(result);
    setMusicalGrid(deck, proposal.grid);
    return proposal.grid;
  },
  grid: (deck) => ({ ...pendingGrids.get(deck)! }),
};

window.__libertasLibraryTest = {
  clear: () => library.clear(),
  async importGenerated(name = 'library-test.wav', durationSeconds = 4, frequencyHz = 440) {
    const encoded = createSineWav({ durationSeconds, sampleRate: 48_000, frequencyHz, amplitude: 0.2 });
    return library.importBlob(name, new Blob([encoded], { type: 'audio/wav' }), 1);
  },
  list: () => library.list(),
  search: (query) => library.search(query),
  get: (id) => library.get(id),
  prepare: (id, preparation) => library.updatePreparation(id, preparation),
  capture: (id, deck) => captureLibraryPreparation(id, deck),
  load: (id, deck) => loadLibraryTrackById(id, deck),
  createCrate: (name) => library.createCrate(name),
  listCrates: () => library.listCrates(),
  addToCrate: (crateId, trackId) => library.addToCrate(crateId, trackId),
  removeFromCrate: (crateId, trackId) => library.removeFromCrate(crateId, trackId),
  remove: (id) => library.remove(id),
};

window.__libertasMidiTest = {
  apiAvailable: () => webMidi.apiAvailable(),
  connect: () => webMidi.connect(),
  addBinding: (binding) => midiEngine.addBinding(binding),
  clearBindings: () => midiEngine.clearBindings(),
  learn: (target, mode, min, max, inputId) => midiEngine.startLearn(target, mode, min, max, inputId),
  dispatch: (data, sourceInputId) => webMidi.dispatchSynthetic(data, sourceInputId),
  status: () => webMidi.status(),
  targets: () => MIDI_TARGETS.map((descriptor) => ({ ...descriptor })),
  profiles: () => midiProfiles.list(),
  activeProfile: () => midiProfiles.active(),
  saveProfile(name, id) {
    const profile = midiProfiles.save({
      ...(id === undefined ? {} : { id }),
      name,
      bindings: midiEngine.listBindings(),
      feedback: midiFeedback.listBindings(),
    });
    midiProfiles.activate(profile.id);
    return profile;
  },
  activateProfile(id) {
    return applyMidiProfile(midiProfiles.activate(id));
  },
  removeProfile(id) {
    midiProfiles.remove(id);
    applyMidiProfile(midiProfiles.active());
  },
  replaceFeedback(bindings) {
    midiFeedback.replaceBindings(bindings);
  },
  feedbackBindings: () => midiFeedback.listBindings(),
  publishFeedback: (target, value) => midiFeedback.publish(target, value),
  pulseFeedback: (target) => midiFeedback.pulse(target),
  feedbackLog: () => midiFeedbackLog.map((message) => ({ ...message, data: [...message.data] as [number, number, number] })),
};

window.__libertasRecordingTest = {
  supported: () => recording.supported(),
  start: () => recording.start(),
  async stop() {
    const result = await recording.stop();
    return {
      status: result.status,
      size: result.blob.size,
      type: result.blob.type,
    };
  },
  status: () => recording.status(),
};

window.__libertasAutoMixTest = {
  plan: (outgoing, bars, phraseBars) => autoMix.plan(outgoing, bars, phraseBars),
  arm: () => autoMix.arm(),
  cancel: (reason) => autoMix.cancel(reason),
  override: (value) => autoMix.manualOverride(value),
  status: () => autoMix.status(),
};

const autoMixDirection = document.querySelector<HTMLSelectElement>('#automix-outgoing');
const autoMixBars = document.querySelector<HTMLSelectElement>('#automix-bars');
const autoMixPlanButton = document.querySelector<HTMLButtonElement>('#automix-plan');
const autoMixArmButton = document.querySelector<HTMLButtonElement>('#automix-arm');
const autoMixCancelButton = document.querySelector<HTMLButtonElement>('#automix-cancel');
const autoMixStatusElement = document.querySelector<HTMLPreElement>('#automix-status');
autoMixPlanButton?.addEventListener('click', () => {
  void autoMix.plan(autoMixDirection?.value === 'B' ? 'B' : 'A', Number(autoMixBars?.value ?? 4))
    .then((decision) => render(autoMixStatusElement, decision))
    .catch((error: unknown) => render(autoMixStatusElement, { error: String(error) }));
});
autoMixArmButton?.addEventListener('click', () => {
  void autoMix.arm()
    .then((status) => render(autoMixStatusElement, status))
    .catch((error: unknown) => render(autoMixStatusElement, { error: String(error) }));
});
autoMixCancelButton?.addEventListener('click', () => {
  render(autoMixStatusElement, autoMix.cancel());
});

window.__libertasAutomationTest = {
  targets: () => automation.targetsList(),
  schedule: (lane, leadSeconds) => automation.schedule(lane, leadSeconds),
  cancel: (target) => automation.cancel(target),
};

window.__libertasDualDeckTest = {
  async loadGenerated(durationSeconds = 10, frequencyA = 330, frequencyB = 550, amplitude = 0.35) {
    const [a, b] = await Promise.all([
      deckA.loadEncodedAudio(createSineWav({ durationSeconds, sampleRate: 48_000, frequencyHz: frequencyA, amplitude })),
      deckB.loadEncodedAudio(createSineWav({ durationSeconds, sampleRate: 48_000, frequencyHz: frequencyB, amplitude })),
    ]);
    autoMix.recordLoad('A', 'dual-generated-A');
    autoMix.recordLoad('B', 'dual-generated-B');
    return { a, b };
  },
  async playBoth() {
    const [a, b] = await Promise.all([deckA.play(), deckB.play()]);
    return { a, b };
  },
  async pauseBoth() {
    const [a, b] = await Promise.all([deckA.pause(), deckB.pause()]);
    return { a, b };
  },
  async status() {
    const [a, b, mixerStatus] = await Promise.all([
      deckA.requestStatus(),
      deckB.requestStatus(),
      mixer.requestStatus(),
    ]);
    return { a, b, mixer: mixerStatus };
  },
  blockMainThread,
  async close() {
    await deckA.close();
    await deckB.close();
    channelA.close();
    channelB.close();
    await mixer.close();
    await runtime.close();
  },
};

renderKernel({ capabilities: detectAudioKernelCapabilities() });
render(document.querySelector('#deck-a-status'), { phase: 'Deck A', state: 'locked behavior / ready for load' });
render(document.querySelector('#deck-b-status'), { phase: 'Deck B', state: 'ready for load' });
render(mixerStatusElement, {
  phase: 'Mixer / DSP',
  state: 'channel strips + equal-power crossfader + sample-peak limiter ready',
});
renderMonitorStatus();
renderFxStatus();
void renderSamplerStatus().catch(() => {});
render(syncStatusElement, { phase: 'SYNC', state: 'disabled' });

function waitForCondition(predicate: () => boolean, timeoutMs = 20_000): Promise<void> {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (performance.now() - started >= timeoutMs) {
        reject(new Error('distributed browser condition timed out'));
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });
}

function waitForIceGatheringComplete(connection: RTCPeerConnection, timeoutMs = 5_000): Promise<void> {
  if (connection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      connection.removeEventListener('icegatheringstatechange', onState);
      reject(new Error('ICE gathering timed out'));
    }, timeoutMs);
    const onState = () => {
      if (connection.iceGatheringState !== 'complete') return;
      clearTimeout(timer);
      connection.removeEventListener('icegatheringstatechange', onState);
      resolve();
    };
    connection.addEventListener('icegatheringstatechange', onState);
  });
}

function waitForDataChannelOpen(channel: RTCDataChannel, timeoutMs = 5_000): Promise<void> {
  if (channel.readyState === 'open') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      channel.removeEventListener('open', onOpen);
      reject(new Error('RTCDataChannel open timed out'));
    }, timeoutMs);
    const onOpen = () => {
      clearTimeout(timer);
      channel.removeEventListener('open', onOpen);
      resolve();
    };
    channel.addEventListener('open', onOpen);
  });
}

async function createRtcLoopbackPair(): Promise<{
  a: RtcDataChannelTransport;
  b: RtcDataChannelTransport;
  ordered: boolean;
  close(): void;
}> {
  if (typeof RTCPeerConnection === 'undefined') throw new Error('RTCPeerConnection unavailable');
  const pcA = new RTCPeerConnection();
  const pcB = new RTCPeerConnection();
  const remoteChannel = new Promise<RTCDataChannel>((resolve) => {
    pcB.addEventListener('datachannel', (event) => resolve(event.channel), { once: true });
  });
  const channelA = pcA.createDataChannel(DISTRIBUTED_CHANNEL_LABEL, { ordered: true });

  await pcA.setLocalDescription(await pcA.createOffer());
  await waitForIceGatheringComplete(pcA);
  const offer = pcA.localDescription;
  if (!offer) throw new Error('WebRTC offer local description missing');
  await pcB.setRemoteDescription(offer);
  await pcB.setLocalDescription(await pcB.createAnswer());
  await waitForIceGatheringComplete(pcB);
  const answer = pcB.localDescription;
  if (!answer) throw new Error('WebRTC answer local description missing');
  await pcA.setRemoteDescription(answer);

  const channelB = await remoteChannel;
  await Promise.all([waitForDataChannelOpen(channelA), waitForDataChannelOpen(channelB)]);
  return {
    a: new RtcDataChannelTransport(channelA),
    b: new RtcDataChannelTransport(channelB),
    ordered: channelA.ordered && channelB.ordered,
    close() {
      if (pcA.connectionState !== 'closed') pcA.close();
      if (pcB.connectionState !== 'closed') pcB.close();
    },
  };
}

const hostDistributedNode: DistributedNode = {
  nodeId: 'browser-host',
  label: 'Browser Host',
  capabilities: ['control', 'analysis', 'webrtc-datachannel'],
  requestedRoles: ['mixer'],
};

const remoteDistributedNode: DistributedNode = {
  nodeId: 'browser-remote',
  label: 'Browser Remote',
  capabilities: ['control', 'analysis', 'webrtc-datachannel'],
  requestedRoles: ['mixer', 'worker'],
};

window.__libertasDistributedTest = {
  rtcAvailable: () => typeof RTCPeerConnection !== 'undefined',
  async runControlStress() {
    const pair = await createRtcLoopbackPair();
    const host = new DistributedSession({
      sessionId: 'browser-control-proof',
      hostNodeId: hostDistributedNode.nodeId,
      localNode: hostDistributedNode,
      transport: pair.a,
      onControlIntent(intent) {
        if (intent.target !== 'mixer.crossfader' || intent.action !== 'set' || typeof intent.value !== 'number') {
          throw new Error('unexpected distributed browser control intent');
        }
        mixer.setCrossfader(intent.value);
      },
    });
    const remote = new DistributedSession({
      sessionId: 'browser-control-proof',
      hostNodeId: hostDistributedNode.nodeId,
      localNode: remoteDistributedNode,
      transport: pair.b,
    });

    try {
      host.start();
      remote.start();
      await waitForCondition(() => host.status().peers.length === 1 && remote.status().peers.length === 1);
      host.grantRoles(remoteDistributedNode.nodeId, ['mixer']);
      await waitForCondition(() => remote.status().authority.owners.mixer === remoteDistributedNode.nodeId);

      remote.sendControl({
        intentId: 'distributed-left',
        role: 'mixer',
        target: 'mixer.crossfader',
        action: 'set',
        value: -1,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      const [beforeA, beforeB, beforeMixer] = await Promise.all([
        deckA.requestStatus(),
        deckB.requestStatus(),
        mixer.requestStatus(),
      ]);

      setTimeout(() => {
        remote.sendControl({
          intentId: 'distributed-right',
          role: 'mixer',
          target: 'mixer.crossfader',
          action: 'set',
          value: 1,
        });
      }, 50);
      blockMainThread(600);
      await waitForCondition(() => {
        const status = host.status();
        return status.acceptedMessages >= 3;
      });
      // The distributed command has arrived; allow the existing mixer AudioParam
      // smoothing to settle before sampling its rendered endpoint.
      await new Promise<void>((resolve) => setTimeout(resolve, 80));
      const [afterA, afterB, afterMixer] = await Promise.all([
        deckA.requestStatus(),
        deckB.requestStatus(),
        mixer.requestStatus(),
      ]);
      const hostStatus = host.status();
      const remoteStatus = remote.status();
      return {
        ordered: pair.ordered,
        peerNegotiated: hostStatus.peers[0]?.negotiatedCapabilities ?? [],
        aFrameDelta: afterA.outputCurrentFrame - beforeA.outputCurrentFrame,
        bFrameDelta: afterB.outputCurrentFrame - beforeB.outputCurrentFrame,
        mixerFrameDelta: afterMixer.outputCurrentFrame - beforeMixer.outputCurrentFrame,
        aDiscontinuityDelta: afterA.frameDiscontinuities - beforeA.frameDiscontinuities,
        bDiscontinuityDelta: afterB.frameDiscontinuities - beforeB.frameDiscontinuities,
        mixerDiscontinuityDelta: afterMixer.frameDiscontinuities - beforeMixer.frameDiscontinuities,
        crossfaderGainA: afterMixer.crossfaderGainA,
        crossfaderGainB: afterMixer.crossfaderGainB,
        hostRejectedMessages: hostStatus.rejectedMessages,
        remoteRejectedMessages: remoteStatus.rejectedMessages,
      };
    } finally {
      host.close();
      remote.close();
      pair.close();
    }
  },
  async runAnalysisRoundTrip() {
    const pair = await createRtcLoopbackPair();
    const host = new DistributedSession({
      sessionId: 'browser-worker-proof',
      hostNodeId: hostDistributedNode.nodeId,
      localNode: hostDistributedNode,
      transport: pair.a,
    });
    const remote = new DistributedSession({
      sessionId: 'browser-worker-proof',
      hostNodeId: hostDistributedNode.nodeId,
      localNode: remoteDistributedNode,
      transport: pair.b,
      workHandlers: {
        analysis: (request) => ({
          ok: true,
          outputRefs: [`analysis:${request.inputRefs[0] ?? 'missing'}`],
          metrics: { provider: 'browser-remote-worker', deterministic: true },
        }),
      },
    });

    try {
      host.start();
      remote.start();
      await waitForCondition(() => host.status().peers.length === 1 && remote.status().peers.length === 1);
      return await host.requestWork('analysis', ['sha256:browser-fixture'], { mode: 'rhythm' }, 5_000);
    } finally {
      host.close();
      remote.close();
      pair.close();
    }
  },
};

startWorkstationGui();

export {};
