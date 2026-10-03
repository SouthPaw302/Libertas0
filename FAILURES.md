# Libertas0 Failure Memory

## F-0001 — Unit runner discovered Playwright suite
- date: 2026-10-03
- exact SHA: `f474d0a893297c195ce574b16ccd29df40b7a174`
- module: audio-kernel
- environment: GitHub Actions ubuntu-24.04, Node 24.21.0, Vitest 4.1.11
- symptom: Phase 2 stopped before browser testing because Vitest imported `tests/browser/audio-kernel.spec.ts` and Playwright rejected `test()` outside its runner.
- reproduction: run `vitest run` while Playwright `*.spec.ts` files are under the repository tree.
- evidence: Audio Kernel Gate run `37104471064`, failed step `Typecheck, unit test, build`.
- cause: unit-test discovery scope was not explicitly separated from browser-test discovery.
- disposition: fixed by restricting Vitest unit execution to `src`; browser tests remain owned by Playwright.

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
