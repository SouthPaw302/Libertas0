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

## F-0003 — Deck A unit-test arithmetic specification errors
- date: 2026-10-03
- exact SHA: `8d1980930e6d9fa75062f5fb2537c7a8f82bb44b`
- module: deck-a
- environment: GitHub Actions ubuntu-24.04, Node 24.21.0, Vitest 4.1.11
- symptom: two source-frame unit tests failed before browser execution.
- evidence: Deck A Gate run `37107015643`.
- cause: the partition list summed to 48,064 output frames while the reference advanced 48,000; the long simulation also used a decimal matcher threshold slightly tighter than the observed IEEE-754 accumulation error.
- disposition: test specification corrected. Product transport code was not changed by this fix.

## F-0004 — Audio-kernel regression test coupled to diagnostic UI visibility
- date: 2026-10-03
- exact SHA: `ada06e1fa91d679acfc553c5350c5ebe10aa77e2`
- module: deck-a / audio-kernel regression
- environment: GitHub Actions, Chrome for Testing 153.0.8010.12
- symptom: all Deck A Chrome tests passed, but two audio-kernel regression tests timed out attempting to click `#activate`.
- evidence: Deck A Gate run `37107063267`.
- cause: the diagnostic kernel controls were moved into a collapsed `<details>` element as Deck A became the primary harness, while the regression test remained coupled to a visible button.
- disposition: regression test now invokes the stable kernel test API directly. Product audio behavior was not changed.
