# Track Intelligence Research — October 2026

Web Workers remain the correct browser primitive for analysis that should not occupy the UI thread. Realtime AudioWorklet remains reserved for low-latency rendering and is not used as an analysis worker.

The Web Audio decode provider already returns decoded PCM at the runtime AudioContext sample rate. Phase 9 reuses that provider, copies channels into one mono analysis buffer, and transfers ownership of that buffer to a dedicated worker.

Existing browser MIR libraries remain candidates rather than dependencies:
- Meyda supports offline and realtime JavaScript audio feature extraction.
- Essentia.js / WebAssembly-style MIR remains a future provider candidate.
- model-based WebGPU/WebNN/ONNX providers remain optional later candidates.

The first reference provider is dependency-light deterministic DSP so its confidence, errors, and failure modes are inspectable before introducing learned models.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext
- https://github.com/meyda/meyda
