import {
  analyzeMonoPcm,
  type TrackAnalysisOptions,
} from './TrackAnalysisCore';

interface AnalysisRequest {
  id: number;
  sampleRate: number;
  samples: ArrayBuffer;
  options?: TrackAnalysisOptions;
}

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  const request = event.data;
  try {
    const result = analyzeMonoPcm(
      new Float32Array(request.samples),
      request.sampleRate,
      request.options,
    );
    self.postMessage({
      id: request.id,
      ok: true,
      result: { ...result, execution: 'web-worker' as const },
    });
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
