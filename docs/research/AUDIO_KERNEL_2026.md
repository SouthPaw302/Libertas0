# Audio Kernel Research — October 2026

## Question
What should own realtime browser musical execution in Libertas0 today?

## Current standards findings

### AudioWorklet
Web Audio executes rendering on a dedicated rendering thread. AudioWorklet exposes the context sample rate, context time, and current sample frame to the processor.

Web Audio 1.1 defines render quanta as blocks of sample frames. The default render quantum is 128 frames, but the specification now permits configuration through `renderSizeHint`. Libertas0 therefore must never encode 128 as a timing invariant.

Sources:
- https://webaudio.github.io/web-audio-api/
- https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope/currentFrame
- https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope/currentTime

### Shared memory
`SharedArrayBuffer` is available only when the page is cross-origin isolated in a secure context. Libertas0 will configure COOP/COEP and capability-detect shared memory. The first kernel deliberately does not depend on it; later PCM/ring-buffer work may.

Sources:
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
- https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated

### WebCodecs audio decoding
`AudioDecoder` can run in Dedicated Workers but remains non-Baseline/limited across major browsers. It may become a decoder provider but cannot be the only decoder.

Source:
- https://developer.mozilla.org/en-US/docs/Web/API/AudioDecoder

## Toolchain
- Vite 8.1 — current 2026 Vite generation.
- TypeScript 6 — current typed application language baseline.
- Vitest 4.1 — deterministic unit tests.
- Playwright 1.63 — browser runtime gate with Chrome for Testing.

## Decision
Reference browser kernel:
1. TypeScript control layer.
2. AudioWorklet realtime processor.
3. Absolute sample-frame signal generation/scheduling.
4. Runtime render-quantum discovery.
5. No React dependency.
6. No WASM dependency in the reference kernel.
7. No shared-memory dependency until deck PCM transport requires it.
8. No forced device sample rate.
9. Browser runtime test deliberately stalls the main thread while the worklet clock must continue.

WASM/native implementations may later compete behind the same contract. They must outperform or materially improve the proven reference rather than replacing it by assumption.
