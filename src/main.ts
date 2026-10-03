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
import { createSineWav } from './testing/wavFixture';
import { MusicalClock, type BeatGrid, type MusicalPosition } from './music/MusicalClock';

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
  rms(): number;
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

declare global {
  interface Window {
    __libertasKernelTest: LibertasKernelTestApi;
    __libertasDeckATest: LibertasDeckTestApi;
    __libertasDeckBTest: LibertasDeckTestApi;
    __libertasMixerTest: LibertasMixerTestApi;
    __libertasDualDeckTest: LibertasDualDeckTestApi;
    __libertasMusicalClockTest: LibertasMusicalClockTestApi;
  }
}

const runtime = new BrowserAudioRuntime();
const kernel = new BrowserAudioKernel(runtime);
const mixer = new MixerController(runtime);
await mixer.initialize();

const deckA = new DeckAController(runtime, undefined, { node: mixer.inputNode, input: 0 });
const deckB = new DeckBController(runtime, undefined, { node: mixer.inputNode, input: 1 });

const musicalClocks = new Map<'A' | 'B', MusicalClock>();
const pendingGrids = new Map<'A' | 'B', BeatGrid>([
  ['A', { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 }],
  ['B', { bpm: 120, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 }],
]);

const kernelStatusElement = document.querySelector<HTMLPreElement>('#status');
const activateButton = document.querySelector<HTMLButtonElement>('#activate');
const stopButton = document.querySelector<HTMLButtonElement>('#stop');
const mixerStatusElement = document.querySelector<HTMLPreElement>('#mixer-status');
const mixerMaster = document.querySelector<HTMLInputElement>('#mixer-master');
const mixerStatusButton = document.querySelector<HTMLButtonElement>('#mixer-status-button');
const clockRefreshButton = document.querySelector<HTMLButtonElement>('#clock-refresh');

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
    void deck.loadFile(file).then((status) => render(statusElement, status)).catch((error: unknown) => render(statusElement, { error: String(error) }));
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

function getDeck(deck: 'A' | 'B'): DeckController {
  return deck === 'A' ? deckA : deckB;
}

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
  const clock = musicalClocks.get(deck);
  if (clock) clock.setGrid(grid);
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
mixerStatusButton?.addEventListener('click', () => {
  void mixer.requestStatus().then((status) => render(mixerStatusElement, status)).catch((error: unknown) => render(mixerStatusElement, { error: String(error) }));
});

function blockMainThread(milliseconds: number): void {
  const end = performance.now() + milliseconds;
  while (performance.now() < end) {
    // Deliberate UI/main-thread stall for realtime proof.
  }
}

function makeDeckTestApi(deck: DeckController, defaultFrequencyHz: number): LibertasDeckTestApi {
  return {
    async loadGeneratedTone(durationSeconds = 10, frequencyHz = defaultFrequencyHz, amplitude = 0.35) {
      return deck.loadEncodedAudio(createSineWav({
        durationSeconds,
        sampleRate: 48_000,
        frequencyHz,
        amplitude,
      }));
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
    await deckA.close();
    await deckB.close();
    await mixer.close();
    await runtime.close();
  },
  capabilities: detectAudioKernelCapabilities,
  blockMainThread,
};

window.__libertasDeckATest = makeDeckTestApi(deckA, 330);
window.__libertasDeckBTest = makeDeckTestApi(deckB, 550);

window.__libertasMixerTest = {
  status: () => mixer.requestStatus(),
  setMasterVolume: (volume) => mixer.setMasterVolume(volume),
  rms: () => mixer.measureRms(),
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

window.__libertasDualDeckTest = {
  async loadGenerated(durationSeconds = 10, frequencyA = 330, frequencyB = 550, amplitude = 0.35) {
    const [a, b] = await Promise.all([
      deckA.loadEncodedAudio(createSineWav({ durationSeconds, sampleRate: 48_000, frequencyHz: frequencyA, amplitude })),
      deckB.loadEncodedAudio(createSineWav({ durationSeconds, sampleRate: 48_000, frequencyHz: frequencyB, amplitude })),
    ]);
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
    await mixer.close();
    await runtime.close();
  },
};

renderKernel({ capabilities: detectAudioKernelCapabilities() });
render(document.querySelector('#deck-a-status'), { phase: 'Deck A', state: 'locked behavior / ready for load' });
render(document.querySelector('#deck-b-status'), { phase: 'Deck B', state: 'ready for load' });
render(mixerStatusElement, { phase: 'Mixer', state: 'two-input realtime mixer ready' });

export {};
