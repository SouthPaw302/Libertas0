# Local Debug Session Log

## 2026-10-04 — PERFORMANCE-TRANSPORT-T5-001

- Exact SHA: `b9a8317b3c90d4d975746b01b62998792f195d6e`
- Handoff commit: `6fbcbf22301df212a742b2b738133391be1c8d0d`
- Runtime: Windows 10, Codex tiny in-app browser, Realtek output, 48 kHz.
- Automated gate: 24 unit/simulation PASS; 22 Chrome runtime/regression PASS.
- Physical: ordinary Cue, Hot Cue 1, +/-50 ms jog, four-beat loop, 600 ms UI stall, dual-deck independence, five-minute hold, and SYNC recovery all passed with zero frame discontinuities.
- Final loop telemetry: 156 wraps, source frame 178,496 inside [168,000, 264,000], A playing and looping; B playing and SYNC-locked; follower transport seeks 0.
- Blocker: explicit follower Deck B Hot Cue did not produce verifiable hot-cue/performance-jump telemetry through the available exact-SHA browser surface. Fresh user audible confirmation was also not recorded for this run.
- Phase 8 not started.

## 2026-10-04 — PERFORMANCE-TRANSPORT-T5-002

- Fresh Cue, Hot Cue, four-beat loop, and jog checks passed in the tiny browser with zero discontinuities.
- SYNC re-locked with zero discontinuities and zero additional follower transport seeks.
- User confirmed hearing the decks syncing; audible confirmation is recorded as PASS.
- B-follower Hot Cue remains NOT_EVALUATED because the exact browser surface exposes only Deck A controls and no verifiable page-context harness was available.
- Prior five-minute / 156-wrap hold carried forward; not repeated. Phase 8 not started.

## 2026-10-04 — MIXER-DSP-T5-001

- Exact SHA: `3c491c1fc37592e16a284676f569afcbe6423bf1`
- Handoff commit: `7c60686b80c3892549aa5d6eefe0b7c222bcbdbf`
- Runtime: Windows 10, Codex tiny in-app browser tab 9, port 5182, Realtek output, 48 kHz.
- Automated gate: 30 unit/simulation PASS; 29 Chrome runtime/regression PASS; active-DSP stress 27,776 frames per path with zero discontinuities.
- Physical DSP: trim, EQ, bipolar filters, crossfader, master, and limiter telemetry passed. Limiter pre-limit peak was 1.797890, limited samples 447,388, maximum gain reduction 5.538751 dB, hard clips after limiter 0, output peak 0.950221.
- Physical SYNC/transport under DSP: Cue, B-follower Hot Cue, loop, and jog passed. B Hot Cue produced `performanceJumpCount +1` and `hotCueTriggerCount +1`; SYNC re-locked with zero additional follower seeks and zero follower discontinuities.
- 600 ms active-DSP stall: A/B/mixer advanced 89,856 / 89,856 / 80,640 frames; discontinuity deltas 0 / 0 / 0; transport-seek deltas 0 / 0.
- Final five-minute mixed hold used 610-second fixtures and passed all six checkpoints. Both decks remained playing; SYNC stayed locked; stale snapshots stayed 0; no new discontinuities; post-limiter hard clips 0.
- User confirmed hearing the current Mixer/DSP run cleanly in the tiny browser. Report promoted to PASS. Phase 9 not started.

## 2026-10-04 — INTELLIGENCE-T5-001

- Exact SHA: `7fcb8627d5d7a82164bd097d1523941951f8d698`
- Handoff commit: `c3082c3d6e366caed9b9891e8476c7fed114545b`
- Runtime: Windows 10, Codex tiny in-app browser tab 10, port 5183, Realtek output, 48 kHz.
- Automated gate: 33 unit/simulation PASS; 32 Chrome runtime/regression PASS.
- Real material: both 305-second Tribal House WAVs were byte-identical (SHA-256 `639634136FE1630941F391B7667C7CD5CD0855D95651BF1ED77971618854FE1D`).
- Analyzer: `libertas.onset-autocorrelation.v1`, Web Worker; both files proposed 144.5839447 BPM, firstBeatFrame 13,920 (0.29 s), tempo confidence 0.252615, phase confidence 0.515058, grid confidence 0.360709, `recommended=false`.
- Determinism: same file twice produced BPM delta 0, anchor delta 0 frames, stable confidence/provenance; duplicate agreement was exact.
- Manual A/B grids stayed 120 BPM / firstBeatFrame 0 / 4 beats per bar after analysis. Apply, manual repair, analyzer-derived ordinary-track SYNC, and audible verification were not run because the required confidence/plausibility gate blocked.
- Report status: BLOCKED. Phase 9 remains `LOCAL_DEBUG`; Phase 10 not started.
