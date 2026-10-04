import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import type {
  TrackAnalysisOptions,
  TrackAnalysisResult,
} from './TrackIntelligenceEngine';

interface PendingAnalysis {
  resolve: (result: TrackAnalysisResult) => void;
  reject: (error: Error) => void;
  timeout: number;
}

export class TrackIntelligenceController {
  private worker: Worker | null = null;
  private requestSequence = 1;
  private readonly pending = new Map<number, PendingAnalysis>();

  constructor(private readonly runtime: BrowserAudioRuntime) {}

  async analyzeEncodedAudio(
    encoded: ArrayBuffer,
    options: TrackAnalysisOptions = {},
  ): Promise<TrackAnalysisResult> {
    await this.runtime.initialize();
    const decoded = await this.runtime.context.decodeAudioData(encoded.slice(0));
    const mono = new Float32Array(decoded.length);

    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const data = decoded.getChannelData(channel);
      const scale = 1 / decoded.numberOfChannels;
      for (let i = 0; i < mono.length; i += 1) {
        mono[i] += (data[i] ?? 0) * scale;
      }
    }

    return this.analyzeMono(mono, decoded.sampleRate, options);
  }

  analyzeFile(file: File, options: TrackAnalysisOptions = {}): Promise<TrackAnalysisResult> {
    return file.arrayBuffer().then((encoded) => this.analyzeEncodedAudio(encoded, options));
  }

  analyzeMono(
    mono: Float32Array,
    sampleRate: number,
    options: TrackAnalysisOptions = {},
    timeoutMs = 30_000,
  ): Promise<TrackAnalysisResult> {
    const worker = this.requireWorker();
    const requestId = this.requestSequence++;
    const transferable = mono.buffer as ArrayBuffer;

    return new Promise<TrackAnalysisResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Track analysis timed out: ${requestId}`));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timeout });
      worker.postMessage(
        { type: 'analyze', requestId, sampleRate, monoBuffer: transferable, options },
        [transferable],
      );
    });
  }

  close(): void {
    for (const [requestId, pending] of this.pending) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error(`Track intelligence closed before response: ${requestId}`));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  private requireWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(
      new URL('./track-intelligence.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent) => {
      const message = event.data as {
        type: 'result' | 'error';
        requestId: number;
        result?: TrackAnalysisResult;
        error?: string;
      };
      const pending = this.pending.get(message.requestId);
      if (!pending) return;

      window.clearTimeout(pending.timeout);
      this.pending.delete(message.requestId);

      if (message.type === 'error' || !message.result) {
        pending.reject(new Error(message.error ?? 'Track analysis failed'));
        return;
      }
      pending.resolve(message.result);
    };

    worker.onerror = (event) => {
      const error = new Error(event.message || 'Track intelligence worker failed');
      for (const [requestId, pending] of this.pending) {
        window.clearTimeout(pending.timeout);
        pending.reject(error);
        this.pending.delete(requestId);
      }
    };

    this.worker = worker;
    return worker;
  }
}
