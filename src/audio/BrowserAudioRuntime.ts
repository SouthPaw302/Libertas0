export interface AudioRuntimeCapabilities {
  audioContext: boolean;
  audioWorklet: boolean;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
}

export function detectAudioRuntimeCapabilities(): AudioRuntimeCapabilities {
  return {
    audioContext: typeof AudioContext !== 'undefined',
    audioWorklet: typeof AudioWorkletNode !== 'undefined',
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  };
}

export class BrowserAudioRuntime {
  private audioContext: AudioContext | null = null;
  private readonly loadedModules = new Set<string>();

  async initialize(): Promise<void> {
    if (this.audioContext) return;

    const capabilities = detectAudioRuntimeCapabilities();
    if (!capabilities.audioContext || !capabilities.audioWorklet) {
      throw new Error('AudioContext + AudioWorklet are required');
    }

    this.audioContext = new AudioContext({ latencyHint: 'interactive' });
  }

  get context(): AudioContext {
    if (!this.audioContext) {
      throw new Error('audio runtime is not initialized');
    }
    return this.audioContext;
  }

  async ensureWorkletModule(url: string): Promise<void> {
    await this.initialize();
    if (this.loadedModules.has(url)) return;
    await this.context.audioWorklet.addModule(url);
    this.loadedModules.add(url);
  }

  async resume(): Promise<void> {
    await this.initialize();
    if (this.context.state !== 'running') {
      await this.context.resume();
    }
  }

  async close(): Promise<void> {
    this.loadedModules.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;
  }
}
