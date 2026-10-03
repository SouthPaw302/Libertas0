# Libertas0 Failure Memory

## F-0001 — Unit runner discovered Playwright suite
- date: 2026-10-03
- exact SHA: `f474d0a893297c195ce574b16ccd29df40b7a174`
- module: audio-kernel
- environment: GitHub Actions ubuntu-24.04, Node 24.21.0, Vitest 4.1.11
- symptom: Phase 2 stopped before browser testing because Vitest imported `tests/browser/audio-kernel.spec.ts`.
- evidence: Audio Kernel Gate run `37104471064`.
- cause: unit-test discovery scope was not explicitly separated from browser-test discovery.
- disposition: fixed; Vitest owns `src/**`, Playwright owns `tests/browser/**`.

## F-0002 — Runtime gate treated startup discontinuity as stress-interval failure
- date: 2026-10-03
- exact SHA: `2c0c10ffb7f2f29d731dfd7b2cd185c076a70c6e`
- module: audio-kernel
- environment: GitHub Actions ubuntu-24.04, Chrome for Testing 153.0.8010.12
- symptom: main-thread-stall test failed because `frameDiscontinuities` was 1 while the worklet clock otherwise advanced and the dynamic render-quantum test passed.
- evidence: Audio Kernel Gate run `37104580952`, artifact `11267991241`.
- cause: the assertion used the absolute lifetime count, which can include context startup/resume behavior before the measured stall interval.
- disposition: fixed by baselining before the deliberate stall and requiring zero *new* discontinuities during the interval. The lifetime count remains exposed as telemetry.

## Required entry
- ID
- date
- exact SHA
- module
- environment
- symptom
- reproduction
- evidence
- confirmed/suspected cause
- disposition: prohibited / unresolved / reconsiderable
