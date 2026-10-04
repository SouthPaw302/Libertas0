import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import { DecodeAudioDataProvider } from '../deck/PcmDecoder';
import type { BeatGrid } from '../music/MusicalClock';
import type {
  TrackAnalysisOptions,
  TrackAnalysisResult,
} from './TrackAnalysisCore';

interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: TrackAnalysisResult;
  error?: string;
}

export interface TrackGridProposal {
  grid: BeatGrid;
  confidence: number;
  recommended: boolean;
  provider: string;
}

export class TrackIntelligenceController {
  private requestId = 1;
  private readonly decoder: DecodeAudioDataProvider;

  constructor(private readonly runtime: BrowserAudioRuntime) {
    this.decoder = new DecodeAudioDataProvider(runtime);
  }

  workerAvailable(): boolean {
    return typeof Worker !== 'undefined';
  }

  async analyzeEncodedAudio(
    encoded: ArrayBuffer,
    options: TrackAnalysisOptions = {},
  ): Promise<TrackAnalysisResult> {
    if (!this.workerAvailable()) {
      throw new Error('Track Intelligence requires Web Worker support');
    }

    const decoded = await this.decoder.decode(encoded);
    const mono = new Float32Array(decoded.frameCount);
    if (decoded.channelCount === 1) {
      mono.set(decoded.channels[0]!);
    } else {
      const left = decoded.channels[0]!;
      const right = decoded.channels[1]!;
      for (let i = 0; i < mono.length; i += 1) {
        mono[i] = ((left[i] ?? 0) + (right[i] ?? 0)) * 0.5;
      }
    }

    const worker = new Worker(new URL('./trackAnalysis.worker.ts', import.meta.url), {
      type: 'module',
    });
    const id = this.requestId++;

    return new Promise<TrackAnalysisResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        worker.terminate();
        reject(new Error('Track Intelligence worker timed out'));
      }, 15_000);

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.id !== id) return;
        window.clearTimeout(timeout);
        worker.terminate();
        if (!event.data.ok || !event.data.result) {
          reject(new Error(event.data.error ?? 'Track Intelligence worker failed'));
          return;
        }
        resolve(event.data.result);
      };
      worker.onerror = (event) => {
        window.clearTimeout(timeout);
        worker.terminate();
        reject(new Error(event.message || 'Track Intelligence worker crashed'));
      };

      worker.postMessage(
        { id, sampleRate: decoded.sampleRate, samples: mono.buffer, options },
        [mono.buffer],
      );
    });
  }

  proposal(result: TrackAnalysisResult): TrackGridProposal {
    return {
      grid: {
        bpm: result.bpm,
        firstBeatFrame: result.firstBeatFrame,
        beatsPerBar: result.beatsPerBar,
        beatUnit: result.beatUnit,
      },
      confidence: result.gridConfidence,
      recommended: result.recommended,
      provider: result.provider,
    };
  }
}
