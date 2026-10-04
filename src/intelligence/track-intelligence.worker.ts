import {
  analyzeMonoPcm,
  type TrackAnalysisOptions,
} from './TrackIntelligenceEngine';

interface AnalyzeMessage {
  type: 'analyze';
  requestId: number;
  sampleRate: number;
  monoBuffer: ArrayBuffer;
  options?: TrackAnalysisOptions;
}

self.onmessage = (event: MessageEvent<AnalyzeMessage>) => {
  const message = event.data;
  if (!message || message.type !== 'analyze') return;

  try {
    const result = analyzeMonoPcm(
      new Float32Array(message.monoBuffer),
      message.sampleRate,
      message.options,
    );
    self.postMessage({ type: 'result', requestId: message.requestId, result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
