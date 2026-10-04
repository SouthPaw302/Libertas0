# Track Intelligence Research — October 2026

## Browser decode
Web Audio `decodeAudioData()` remains broadly available for complete encoded files and returns PCM resampled to the decoding AudioContext sample rate.

Reference:
https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData

## Background analysis
Phase 9 keeps analysis off the realtime AudioWorklet path. PCM is transferred into a dedicated Web Worker. This prevents tempo/feature analysis from becoming a musical clock or render-thread dependency.

## Feature-provider survey
Meyda provides established time/spectral features such as RMS, zero-crossing rate, spectral centroid and spectral flux. Essentia.js remains a broader WebAssembly audio-analysis option. Neither is required for the first Libertas reference provider because the immediate goal is a small deterministic BPM/beat-anchor proposal with a narrow auditable trust surface.

References:
- https://github.com/meyda/meyda/blob/main/docs/audio-features.md
- https://mtg.github.io/essentia.js/

## Provider strategy
The reference analyzer is intentionally dependency-free and replaceable. Future candidates may include:
- Essentia.js/WASM;
- ONNX/WebGPU/WebNN models;
- native providers.

Any future provider must emit the same proposal/provenance contract and must not gain realtime authority merely because its accuracy is better.
