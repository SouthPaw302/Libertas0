import {
  BrowserAudioKernel,
  detectAudioKernelCapabilities,
  type AudioKernelStatus,
} from './audio/BrowserAudioKernel';

interface LibertasKernelTestApi {
  start(): Promise<AudioKernelStatus>;
  stop(): Promise<AudioKernelStatus>;
  status(): Promise<AudioKernelStatus>;
  close(): Promise<void>;
  capabilities(): ReturnType<typeof detectAudioKernelCapabilities>;
  blockMainThread(milliseconds: number): void;
}

declare global {
  interface Window {
    __libertasKernelTest: LibertasKernelTestApi;
  }
}

const kernel = new BrowserAudioKernel();
const statusElement = document.querySelector<HTMLPreElement>('#status');
const activateButton = document.querySelector<HTMLButtonElement>('#activate');
const stopButton = document.querySelector<HTMLButtonElement>('#stop');

function render(status: unknown): void {
  if (statusElement) statusElement.textContent = JSON.stringify(status, null, 2);
}

async function start(): Promise<AudioKernelStatus> {
  await kernel.startSignal();
  const status = await kernel.requestStatus();
  render(status);
  return status;
}

async function stop(): Promise<AudioKernelStatus> {
  kernel.stopSignal();
  const status = await kernel.requestStatus();
  render(status);
  return status;
}

activateButton?.addEventListener('click', () => {
  void start().catch((error: unknown) => render({ error: String(error) }));
});

stopButton?.addEventListener('click', () => {
  void stop().catch((error: unknown) => render({ error: String(error) }));
});

window.__libertasKernelTest = {
  start,
  stop,
  status: () => kernel.requestStatus(),
  close: () => kernel.close(),
  capabilities: detectAudioKernelCapabilities,
  blockMainThread(milliseconds: number) {
    const end = performance.now() + milliseconds;
    while (performance.now() < end) {
      // Intentional main-thread stall. The AudioWorklet render thread must keep advancing.
    }
  },
};

render({ capabilities: detectAudioKernelCapabilities() });

export {};
