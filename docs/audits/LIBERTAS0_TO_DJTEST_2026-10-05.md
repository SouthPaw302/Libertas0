# Libertas0 Full Audit → LibertyDJ/DJtest Surgical Upgrade

Date: 2026-10-05

## Libertas0 audit result

Authority: `main` at `4c1fd53b93386ad3ed3918ea97843b9ef658c1eb`.

All 12 planned modules are LOCKED:
Development OS, verification fabric, audio kernel, Deck A, Deck B/mixer, musical clock, SYNC, performance transport, mixer/DSP, track intelligence, library/MIDI/recording/automation, and Distributed Libertas.

Current proven-capability count: 21.

Research/available-only capabilities remain explicitly unpromoted:
WebAssembly, SharedArrayBuffer/Atomics, WebGPU, WebNN, NPU, ONNX Runtime, and native audio provider.

Every product module has a contract, workflow, and recorded evidence path. The System Contract still forbids React timers, network, agents, inference, filesystem, or persistence from becoming realtime timing authority.

## Phase 10 Drive verification

The saved master `PHASE10-T5-002-master-recording.webm` independently decodes to about 62.03 s of 48 kHz stereo Opus/WebM.

Independent checks:
- file size: 1,003,132 bytes;
- mean level: about -17.4 dB;
- peak: about -3.6 dBFS;
- no >=100 ms silence events below -50 dBFS.

The committed Drive analysis additionally identifies coherent material from both uploaded source decks and passes the post-mixer-content gate.

## Phase 11 verification

Product SHA `51518afe2aa2b4eabacd55bf22028d12502e099a` passed:
- System Contract;
- 51 unit/simulation tests;
- 40 Chromium runtime/regression tests;
- ordered WebRTC control;
- artifact-reference remote work;
- capability-aware worker routing/retry;
- repeated WebRTC session churn;
- all locked Phase 2-10 regressions.

Distributed execution is control/work only. It is not a musical clock.

## DJtest audit

DJtest authority inspected at `e599eee682a2f77fd10bd0d9b39e4f1d2b0676cb`.

DJtest has a large product surface and many unit tests but no GitHub workflows on the branch.

### Preserve

Keep the DJtest product/UI layer and features that do not need replacement:
- React decks/mixer/library presentation;
- AutoDJ planning;
- library UX and playlists;
- keyboard/MIDI presentation;
- ecosystem/Fidelis/Aether integration;
- mobile/desktop/Tauri presentation and routing;
- performance pads and non-authoritative UI helpers.

### Replace or wrap with proven Libertas0 modules

1. Browser audio ownership and dual-deck render authority.
2. Musical Clock and local SYNC authority.
3. Performance transport timing for cue/hotcue/loop/jog.
4. Mixer/DSP render path and automation scheduling.
5. Track-intelligence provider path for tested BPM/grid proposal.
6. Browser-local library/MIDI/recording/automation services where Libertas0 is more deterministic.
7. Distributed session protocol and role/capability boundary.
8. Verification fabric: System Contract, per-module workflows, artifacts, exact-SHA evidence, and debug bus.

### Timing-authority conflicts to remove

DJtest currently contains network timing code that can compute rate and seek corrections:
- `src/features/network/sessionClock.ts`
- `src/features/network/distributedDeckSync.ts`
- `src/features/sync/core/networkClock.ts`

These can remain for observability/advisory projection only. They must not directly own deck seek/rate correction after surgery.

DJtest also contains a `MusicalFollowerController` that can request hard realignment seeks. The surgery should replace local follower correction with the proven Libertas0 SYNC path, where performance jumps are explicit and hidden maintenance seeks remain zero on the proven path.

## Surgical order

1. Add Development OS + CI/evidence baseline to a new DJtest surgery branch.
2. Add Libertas0 audio kernel/deck adapters behind the existing DJtest UI.
3. Switch A/B realtime authority to Libertas0 without changing UI semantics.
4. Replace local clock/SYNC authority.
5. Replace performance transport timing.
6. Replace mixer/DSP authority.
7. Integrate Track Intelligence as an explicit proposal/apply provider.
8. Integrate Phase 10 services where they improve determinism without deleting richer DJtest UX.
9. Bound distributed/network control to explicit intents and advisory state only.
10. Run full DJtest regression + browser physical gate before promotion.

No broad rewrite. No GUI replacement. No network-owned realtime clock. No silent fallback to the old sync engine.
