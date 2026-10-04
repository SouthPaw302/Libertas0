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

## F-0005 — Musical-clock browser assertions assumed 48 kHz decode
- date: 2026-10-03
- exact SHA: `ea2f1d9cfd61e02e43099788aac3d6c44f44c76e`
- module: musical-clock
- environment: GitHub Actions, Chrome for Testing 153.0.8010.12
- symptom: two Phase 5 browser tests failed while 11 other runtime/regression tests passed.
- evidence: Musical Clock Gate run `37111277250`.
- cause: the browser AudioContext ran at 44.1 kHz and `decodeAudioData` resampled generated PCM accordingly, but the test expected frame coordinates calculated for 48 kHz.
- disposition: corrected tests to derive all expected musical/source-frame coordinates from the deck's actual `sourceSampleRate`. Musical-clock implementation was unchanged.

## F-0006 — Sample-rate test fix omitted decoded metadata binding
- date: 2026-10-03
- exact SHA: `51cb3e0b7cd33dbb207628376e1b63f89c80c833`
- module: musical-clock
- environment: GitHub Actions TypeScript 6
- symptom: the corrected sample-rate-agnostic browser test failed typecheck because it referenced `loaded` without binding the return value from `loadGenerated`.
- evidence: Musical Clock Gate run `37111377754`.
- cause: test-edit defect only.
- disposition: fixed at `ee7770e00b93cd90ce7ba6728b5ce8c8b4fc817d`; product and musical-clock implementation were unchanged.

## F-0007 — SYNC browser API erased status type
- date: 2026-10-03
- exact SHA: `2bddfc188e3ff4b53a0a98f0fc525b120ebd3f2c`
- module: sync
- environment: GitHub Actions, TypeScript 6
- symptom: Phase 6 stopped at typecheck because the browser test API declared SYNC enable/status results as `unknown`.
- evidence: SYNC Gate run `37174159655`.
- cause: test-harness typing defect; the exported `SyncSessionStatus` contract was not wired into `window.__libertasSyncTest`.
- disposition: fixed by preserving the concrete SYNC session type through the browser test API. Product/controller logic unchanged.

## F-0008 — SYNC reached low phase error but missed strict lock threshold inside gate window
- date: 2026-10-03
- exact SHA: `94f3c9e6e923c066ecfb0093bd609042bcdce855`
- module: sync
- environment: GitHub Actions, Chrome for Testing 153.0.8010.12
- symptom: 15/17 browser tests passed; main-thread-stall SYNC and leader-rate-following passed, but two convergence cases still reported `syncLocked=false` after four seconds.
- evidence: SYNC Gate run `37174194703`. During the stress case phase error improved from -0.01773 to -0.01067 beat with 0 new discontinuities.
- cause: reference controller was deliberately conservative near lock; 1.25 s proportional settle constant did not reliably cross the unchanged 0.01-beat lock threshold inside the four-second gate window.
- disposition: controller settle constant tightened to 0.75 s while retaining the 0.01-beat lock threshold, +/-0.08 correction bound, smoothing, deadband, and no-seek law.

## F-0009 — SYNC Playwright harness raced async module initialization
- date: 2026-10-03
- exact SHA: `76e591fcb5c4c821d280961e06d52faf98780b20`
- module: sync browser gate
- environment: GitHub Actions, Chrome for Testing 153.0.8010.12
- symptom: two SYNC tests failed immediately because `window.__libertasSyncTest` was undefined; two other SYNC runtime tests in the same run passed.
- evidence: SYNC Gate run `37174293181`.
- cause: `page.goto()` completed before the top-level async application module had finished mixer initialization and installed the SYNC test API.
- disposition: browser SYNC tests now wait explicitly for the stable harness API before invoking it. Controller/worklet behavior unchanged.

## F-0010 — SYNC readiness helper recursively called itself
- date: 2026-10-03
- exact SHA: `f6ee91cb48e9a471aa3f6fd79f94f0e1d7ce4266`
- module: sync browser gate
- environment: GitHub Actions, Chrome for Testing 153.0.8010.12
- symptom: all four SYNC browser tests failed in `openSyncHarness()` before SYNC execution because the helper recursively called itself.
- evidence: SYNC Gate run `37174386575`; all 13 locked audio/deck/mixer/musical-clock browser regressions passed in the same run.
- cause: an over-broad test edit replaced the helper's own `page.goto('/')` call with `openSyncHarness(page)`.
- disposition: restored `page.goto('/')` followed by explicit wait for `window.__libertasSyncTest`. SYNC controller/worklet logic unchanged.

## F-0009 — SYNC Playwright tests raced module initialization
- date: 2026-10-03
- exact SHA: `76e591fcb5c4c821d280961e06d52faf98780b20`
- module: sync test harness
- environment: GitHub Actions, Chrome for Testing 153.0.8010.12, Playwright parallel workers
- symptom: 15/17 browser tests passed; two SYNC cases failed immediately because `window.__libertasSyncTest` was undefined. Leader-rate following and reverse-leadership convergence passed on the same SHA.
- evidence: SYNC Gate run `37174293181`.
- cause: `page.goto` completed before the top-level module finished initializing AudioWorklet/mixer and installing the SYNC test API in two parallel test workers.
- disposition: SYNC browser tests now wait explicitly for the stable harness API before executing. Product/controller logic unchanged.

## F-0010 — SYNC harness wait helper recursively called itself
- date: 2026-10-03
- exact SHA: `fb1c1b998e354dd64b9783653e22aec4e1f8078d`
- module: sync test harness
- environment: GitHub Actions, Chrome for Testing 153.0.8010.12
- symptom: all four SYNC browser cases failed before runtime with recursive `openSyncHarness` stack traces; all 13 locked regression tests passed.
- evidence: SYNC Gate run `37174570842`.
- cause: a global replacement intended to swap test-local `page.goto('/')` calls also rewrote the helper's own navigation line into a recursive self-call.
- disposition: helper restored to direct `page.goto('/')` followed by an explicit wait for `window.__libertasSyncTest`. Product/controller logic unchanged.

## F-0011 — Performance transport browser tests used untyped tuple arguments
- date: 2026-10-04
- exact SHA: `a73119565ad46f621fef4a8553b5b25ca7f0d80c`
- module: performance-transport test harness
- environment: GitHub Actions, TypeScript 6
- symptom: Phase 7 stopped at typecheck before browser execution because tuple-destructured Playwright arguments were inferred as possibly undefined.
- evidence: Performance Transport Gate run `37176673868`.
- cause: test-harness argument typing only.
- disposition: replaced tuple arguments with named object parameters. Product/worklet logic unchanged.

## F-0012 — Phase 7 physical proof surface exposed only Deck A performance controls
- date: 2026-10-04
- exact SHA: `b9a8317b3c90d4d975746b01b62998792f195d6e`
- module: performance-transport local proof surface
- environment: Windows 10, Codex headed Chromium, physical Realtek audio path
- symptom: T5 core transport/loop/jog/dual-deck/stress checks passed, but explicit Deck B follower Hot Cue telemetry could not be verified through the visible runtime surface; local report remained BLOCKED.
- evidence: local report commit `ef1c996aa6e5de9c0df94ca372ba048acd01b643`.
- cause: product UI exposed Phase 7 controls only for Deck A even though Deck B controller/test API existed and passed automated browser coverage.
- disposition: expose equivalent Deck B cue/hotcue/loop/jog controls and status in the physical proof UI. Transport engine unchanged.

## F-0013 — Phase 4 dual-deck regression raced async Phase 8 app initialization
- date: 2026-10-04
- exact SHA: `daaf228c8864c2eb323626a36c73ac4c98dc6ceb`
- module: mixer-dsp / locked deck-b-mixer regression
- environment: GitHub Actions, Chrome for Testing 153.0.8010.12
- symptom: 28/29 browser tests passed. The first legacy dual-deck test invoked `window.__libertasDualDeckTest.loadGenerated` before the top-level module had finished initializing the expanded mixer graph.
- evidence: Mixer DSP Gate run `37178505135`.
- cause: legacy Playwright test relied on `page.goto` completion instead of waiting for the stable dual-deck harness API.
- disposition: all deck-b-mixer regression tests now wait for `window.__libertasDualDeckTest`. Mixer/DSP product code unchanged.

## F-0014 — Track Intelligence onset envelope strict-index typing
- date: 2026-10-04
- exact SHA: `70b34a7ea627b021a6bc91efedd797a3733c507c`
- module: intelligence
- environment: GitHub Actions, TypeScript 6 strict indexed access
- symptom: Phase 9 stopped at typecheck before unit/browser execution because Float64Array indexed values were treated as possibly undefined.
- evidence: Track Intelligence Gate run `37180878790`.
- cause: strict typing only in deterministic onset-envelope subtraction.
- disposition: added explicit zero fallback for typed-array reads. Analyzer algorithm unchanged.

## F-0015 — Competing Phase 9 implementation was layered onto the proven branch
- date: 2026-10-04
- broken SHA: `ef89282bd2cfb3a7c8b51716beed4569ac0614bb`
- last proven SHA: `7fcb8627d5d7a82164bd097d1523941951f8d698`
- module: intelligence
- symptom: system-contract validation passed but Track Intelligence gate failed at typecheck with duplicate controllers, duplicate interfaces, duplicate globals, and incompatible result schemas.
- evidence: Track Intelligence Gate run `37180993569`.
- cause: a second alternative Phase 9 implementation was layered over the already-green implementation instead of extending the proven contract.
- disposition: branch content restored forward to the proven `7fcb8627...` tree; only this failure record and later evidence/handoff metadata are retained. No force-reset and no product merge from the broken implementation.
