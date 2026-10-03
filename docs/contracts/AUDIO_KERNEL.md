# Audio Kernel Contract v1

## Responsibility
The audio kernel owns the browser realtime render boundary and authoritative output-frame clock.

It does not own:
- track decoding;
- deck state;
- beat grids;
- SYNC;
- library;
- analysis;
- UI;
- network;
- model inference.

## Realtime source of truth
The AudioWorklet render thread's sample-frame timeline.

No musical event may depend on React rendering, `setTimeout`, `setInterval`, or `requestAnimationFrame`.

## Runtime requirements
- AudioContext + AudioWorklet.
- Actual context sample rate is accepted as authoritative output rate.
- Actual render-quantum length is read at runtime.
- Processor remains deterministic across different render-quantum sizes.
- Cross-origin isolation is configured for future shared-memory use, but SharedArrayBuffer is not required by kernel v1.

## Status
The kernel exposes:
- context state;
- sample rate;
- current frame;
- last render quantum;
- total processed frames;
- process-call count;
- frame discontinuity count;
- signal-running state;
- diagnostic frequency/gain;
- available latency values.

`frameDiscontinuities` measures unexpected gaps in the worklet sample-frame sequence. It is not claimed to be a hardware xrun counter.

## Test-runner ownership
- Vitest owns unit tests under `src/**`.
- Playwright owns browser/runtime tests under `tests/browser/**`.
- One runner must never discover and execute the other runner's suites.

## Phase 2 gates

### T1 — Unit
Absolute-frame signal generation remains identical regardless of arbitrary block partitioning.

### T3 — Build/integration
Typecheck, unit tests, and production build pass.

### T4 — Browser runtime
Real Chrome-for-Testing loads the AudioWorklet, reaches a running AudioContext, reports cross-origin isolation, and advances the worklet sample-frame clock while the page main thread is deliberately blocked.

Required:
- currentFrame advances during a 600 ms main-thread stall;
- advancement exceeds 250 ms worth of output frames;
- frameDiscontinuities does not increase during the measured main-thread stall;
- renderQuantum is observed dynamically, not asserted to equal 128.

### T5 — Local physical
After T1-T4 pass, send the exact SHA to the local debug agent:
- start kernel on the real Windows browser/audio device;
- listen for clean continuous diagnostic tone;
- stress UI/main thread;
- record sample rate, latency, discontinuities, browser/device, and audible result.

Phase 2 cannot become PROVEN until this local gate passes.
