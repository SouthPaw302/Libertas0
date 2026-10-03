import {
  BrowserAudioKernel,
  detectAudioKernelCapabilities,
  type AudioKernelStatus,
} from './audio/BrowserAudioKernel';
import { BrowserAudioRuntime } from './audio/BrowserAudioRuntime';
import { DeckAController, type DeckAStatus } from './deck/DeckAController';
import { createSineWav } from './testing/wavFixture';

interface LibertasKernelTestApi {
  start(): Promise<AudioKernelStatus>;
  stop(): Promise<AudioKernelStatus>;
  status(): Promise<AudioKernelStatus>;
  close(): Promise<void>;
  capabilities(): ReturnType<typeof detectAudioKernelCapabilities>;
  blockMainThread(milliseconds: number): void;
}

interface LibertasDeckATestApi {
  loadGeneratedTone(durationSeconds?: number): Promise<DeckAStatus>;
  play(): Promise<DeckAStatus>;
  pause(): Promise<DeckAStatus>;
  seekFrame(frame: number): Promise<DeckAStatus>;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): Promise<DeckAStatus>;
  status(): Promise<DeckAStatus>;
  rms(): number;
  blockMainThread(milliseconds: number): void;
  close(): Promise<void>;
}

declare global {
  interface Window {
    __libertasKernelTest: LibertasKernelTestApi;
    __libertasDeckATest: LibertasDeckATestApi;
  }
}

const runtime = new BrowserAudioRuntime();
const kernel = new BrowserAudioKernel(runtime);
const deck = new DeckAController(runtime);

const kernelStatusElement = document.querySelector<HTMLPreElement>('#status');
const activateButton = document.querySelector<HTMLButtonElement>('#activate');
const stopButton = document.querySelector<HTMLButtonElement>('#stop');

const deckStatusElement = document.querySelector<HTMLPreElement>('#deck-status');
const deckFile = document.querySelector<HTMLInputElement>('#deck-file');
const deckLoad = document.querySelector<HTMLButtonElement>('#deck-load');
const deckPlay = document.querySelector<HTMLButtonElement>('#deck-play');
const deckPause = document.querySelector<HTMLButtonElement>('#deck-pause');
const deckSeek = document.querySelector<HTMLInputElement>('#deck-seek');
const deckRate = document.querySelector<HTMLInputElement>('#deck-rate');
const deckVolume = document.querySelector<HTMLInputElement>('#deck-volume');
const deckMute = document.querySelector<HTMLInputElement>('#deck-mute');

function renderKernel(status: unknown): void {
  if (kernelStatusElement) kernelStatusElement.textContent = JSON.stringify(status, null, 2);
}

function renderDeck(status: unknown): void {
  if (deckStatusElement) deckStatusElement.textContent = JSON.stringify(status, null, 2);
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

async function refreshDeck(): Promise<DeckAStatus> {
  const status = await deck.requestStatus();
  renderDeck(status);
  if (deckSeek && status.sourceFrames > 0) {
    deckSeek.value = String(Math.round((status.sourceFrame / status.sourceFrames) * 1000));
  }
  return status;
}

activateButton?.addEventListener('click', () => {
  void kernelStart().catch((error: unknown) => renderKernel({ error: String(error) }));
});

stopButton?.addEventListener('click', () => {
  void kernelStop().catch((error: unknown) => renderKernel({ error: String(error) }));
});

deckLoad?.addEventListener('click', () => {
  const file = deckFile?.files?.[0];
  if (!file) {
    renderDeck({ error: 'Choose an audio file first.' });
    return;
  }
  void deck.loadFile(file).then(renderDeck).catch((error: unknown) => renderDeck({ error: String(error) }));
});

deckPlay?.addEventListener('click', () => {
  void deck.play().then(renderDeck).catch((error: unknown) => renderDeck({ error: String(error) }));
});

deckPause?.addEventListener('click', () => {
  void deck.pause().then(renderDeck).catch((error: unknown) => renderDeck({ error: String(error) }));
});

deckSeek?.addEventListener('change', () => {
  void (async () => {
    const status = await deck.requestStatus();
    const fraction = Number(deckSeek.value) / 1000;
    renderDeck(await deck.seekFrame(status.sourceFrames * fraction));
  })().catch((error: unknown) => renderDeck({ error: String(error) }));
});

deckRate?.addEventListener('change', () => {
  try {
    deck.setPlaybackRate(Number(deckRate.value));
    void refreshDeck();
  } catch (error) {
    renderDeck({ error: String(error) });
  }
});

deckVolume?.addEventListener('input', () => {
  try {
    deck.setVolume(Number(deckVolume.value));
  } catch (error) {
    renderDeck({ error: String(error) });
  }
});

deckMute?.addEventListener('change', () => {
  void deck.setMuted(deckMute.checked).then(renderDeck).catch((error: unknown) => renderDeck({ error: String(error) }));
});

window.__libertasKernelTest = {
  start: kernelStart,
  stop: kernelStop,
  status: () => kernel.requestStatus(),
  close: async () => {
    await kernel.close();
    await runtime.close();
  },
  capabilities: detectAudioKernelCapabilities,
  blockMainThread(milliseconds: number) {
    const end = performance.now() + milliseconds;
    while (performance.now() < end) {
      // Intentional main-thread stall. The AudioWorklet render thread must keep advancing.
    }
  },
};

window.__libertasDeckATest = {
  async loadGeneratedTone(durationSeconds = 10) {
    const status = await deck.loadEncodedAudio(
      createSineWav({ durationSeconds, sampleRate: 48_000, frequencyHz: 440, amplitude: 0.5 }),
    );
    renderDeck(status);
    return status;
  },
  play: async () => {
    const status = await deck.play();
    renderDeck(status);
    return status;
  },
  pause: async () => {
    const status = await deck.pause();
    renderDeck(status);
    return status;
  },
  seekFrame: async (frame: number) => {
    const status = await deck.seekFrame(frame);
    renderDeck(status);
    return status;
  },
  setRate: (rate: number) => deck.setPlaybackRate(rate),
  setVolume: (volume: number) => deck.setVolume(volume),
  setMuted: async (muted: boolean) => {
    const status = await deck.setMuted(muted);
    renderDeck(status);
    return status;
  },
  status: () => deck.requestStatus(),
  rms: () => deck.measureRms(),
  blockMainThread(milliseconds: number) {
    const end = performance.now() + milliseconds;
    while (performance.now() < end) {
      // Deliberate UI/main-thread stall for realtime transport proof.
    }
  },
  close: async () => {
    await deck.close();
    await runtime.close();
  },
};

renderKernel({ capabilities: detectAudioKernelCapabilities() });
renderDeck({ phase: 'Deck A', state: 'ready for load' });

export {};
