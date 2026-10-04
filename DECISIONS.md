# Libertas0 Decision Log

## D-0001 — Development OS before product code
Status: ACCEPTED

Every future session must recover exact project truth without reconstructing it from chat history.

## D-0002 — GitHub runner-backed debug bus is the canonical local-agent bridge
Status: ACCEPTED

The local debug agent receives exact SHAs/test requests through GitHub issue #1 and returns durable evidence through `validation/local-debug`.

## D-0003 — Technology is capability-selected, not inherited
Status: ACCEPTED

Previous implementations are reference/candidate material. Nothing becomes canonical merely because it already exists.

## D-0004 — Realtime musical authority is deterministic
Status: ACCEPTED

UI, agents, inference, network, storage, CI, and browser UI timers may request actions but never own realtime musical execution.

## D-0005 — Phase 1 verification fabric promoted
Status: ACCEPTED

The system-contract runner and synthetic local-debug round trip passed on exact recorded SHAs. This proves the bus infrastructure, not physical local execution.

## D-0006 — AudioWorklet is the Phase 2 browser reference kernel
Status: ACCEPTED FOR IMPLEMENTATION

Current Web Audio provides sample-frame authority on the render thread. The reference kernel must use runtime block length and device sample rate rather than assuming 128 frames or 48 kHz. Shared memory and WASM are optional later providers, not prerequisites for the reference proof.

## D-0007 — Audio kernel promoted and locked
Status: ACCEPTED

Audio kernel passed T1-T4 in GitHub/Chrome and T5 on the real local Windows/Edge/Realtek audio path. The exact physical test targeted `c18f3e80d46aa58d0fbead3a6c7f3bb995b97917` and returned zero new discontinuities during the stress interval and zero observed discontinuities during the five-minute run.

## D-0008 — Deck A uses a replaceable decoder provider
Status: ACCEPTED FOR PHASE 3

The reference provider is Web Audio `decodeAudioData`: broadly available, complete-file asynchronous decode, with PCM resampled into the engine AudioContext rate. WebCodecs AudioDecoder remains a later provider because availability is not universal and encoded-chunk decoding does not remove demux requirements.

## D-0009 — Deck A owns PCM transport inside AudioWorklet
Status: ACCEPTED FOR PHASE 3

After decode, the worklet owns source-frame position, interpolation, play/pause, seek, varispeed and output. HTML media and main-thread timers are not transport authorities. Phase 3 volume is audio-timeline automation through an AudioParam.

## D-0010 — Deck A promoted and locked
Status: ACCEPTED

Deck A passed automated T1-T4 on `6bf34aa6a00004b29be21d847748f09b41081ad1` and physical T5 on the real Windows/Edge/Realtek path. Local validation included 30 mixed transport operations, exact 0.5x/1x/1.5x/2x varispeed behavior, volume/mute, a 600 ms main-thread stall with 0 new discontinuities, five minutes of continuous playback with 0 new discontinuities, generated WAV decode, and an ordinary local WAV decode/playback with human audible confirmation.

## D-0011 — Deck A and Deck B share one transport implementation
Status: ACCEPTED FOR PHASE 4

Deck B is a second instance of the same deterministic deck controller/worklet contract, not a copied transport stack. Each instance owns separate PCM and state while sharing the proven AudioContext render timeline.

## D-0012 — Two-input AudioWorklet mixer owns summing
Status: ACCEPTED FOR PHASE 4

Deck outputs feed explicit mixer inputs. The mixer owns realtime summing, master gain, peak telemetry, overload counting and a full-scale safety clamp. SYNC, crossfader law, EQ and final dynamics processing remain outside Phase 4.

## D-0013 — Deck B + mixer promoted and locked
Status: ACCEPTED

Phase 4 passed automated T1-T4 on `6d8e472887c72c9ffe5e80600791edd939a214e9` and physical T5 through the runner-backed local debug bus. The physical run used two ordinary local WAV files simultaneously, verified independent deck transport/seek/volume/mute, master volume, 40 mixed operations, five minutes of simultaneous playback, and ended with zero frame discontinuities on Deck A, Deck B, and mixer.

## D-0014 — Musical clock is a coordinate transform, not another timer
Status: ACCEPTED FOR PHASE 5

Each deck's proven `sourceFrame` remains transport truth. Musical position is derived absolutely from source frame, sample rate, BPM, and first-beat anchor. No JavaScript wall clock, UI timer, or iterative beat counter owns musical time.

## D-0015 — Manual fixed grids precede automatic analysis
Status: ACCEPTED FOR PHASE 5

Phase 5 uses explicit manual grids as ground truth for future SYNC work. Automatic BPM/downbeat systems may later propose grid values but cannot replace deterministic grid semantics.

## D-0016 — Musical Clock promoted and locked
Status: ACCEPTED

Phase 5 passed deterministic unit/simulation and live Chrome integration on `ee7770e00b93cd90ce7ba6728b5ce8c8b4fc817d`. Manual per-deck grids, source-frame/beat round trips, signed pre-roll semantics, bar/beat phase, and non-mutating quantization are proven while all audio-kernel, Deck A, Deck B, and mixer regressions remain green. No new physical gate was required because Musical Clock does not create an audible execution path or control transport.

## D-0017 — SYNC runs inside the realtime deck processors
Status: ACCEPTED FOR PHASE 6

Leader state is exchanged through SharedArrayBuffer under an atomic sequence lock. The follower projects the leader snapshot to its current render frame and computes tempo/phase control without depending on UI polling or JavaScript timers.

## D-0018 — Hidden corrective seeks are prohibited in SYNC maintenance
Status: ACCEPTED FOR PHASE 6

After engagement, SYNC may alter only follower effective playback rate. Steady-state tempo comes from the exact BPM ratio; phase error adds a bounded, smoothed transient rate correction. Any future hard alignment must be an explicit scheduled transport operation, not background maintenance.

## D-0019 — Phase 6 automated SYNC gates passed
Status: ACCEPTED FOR LOCAL VALIDATION

On `76f3c2e75538a5a89af25316508a9fef8e176ea1`, Phase 6 passed 20 unit/simulation tests and 17 Chrome runtime/regression tests. Tempo/phase lock, no hidden corrective seeks, leader-rate following, a 600 ms main-thread stall, and reverse leadership all passed. SYNC remains unpromoted until physical human-listening T5 passes.

## D-0019 — SYNC core promoted and locked
Status: ACCEPTED

Phase 6 passed deterministic simulation, full Chrome runtime/regression gates, and local physical/human-listening validation on `76f3c2e75538a5a89af25316508a9fef8e176ea1`. Generated 120/128 BPM click tracks converged without corrective seeks, leader-rate follow settled at the expected 0.984375 ratio, a 600 ms main-thread stall added zero A/B/mixer discontinuities, a five-minute lock held with zero deck discontinuities, and reverse leadership passed.

Ordinary program-material SYNC is explicitly NOT_EVALUATED because no trusted BPM and first-beat grids were supplied. Promotion of the SYNC core does not erase that limitation.

## D-0020 — Performance transport actions are explicit source-frame commands
Status: ACCEPTED FOR PHASE 7

Cue, hotcue, loop and jog operate inside the existing deck AudioWorklet. Performance jumps are counted separately from ordinary seeks so user actions remain distinguishable from the Phase 6 prohibition on hidden SYNC corrective seeks.

## D-0021 — Phase 7 jog is displacement, not scratch synthesis
Status: ACCEPTED FOR PHASE 7

Jog moves the source frame by an explicit signed amount while preserving play state. Continuous signed platter velocity/reverse scratch rendering is deferred rather than falsely claiming a scratch implementation.

## D-0022 — Phase 7 closes on composite physical + deterministic runtime evidence
Status: ACCEPTED

The Windows/Codex physical run on `b9a8317b3c90d4d975746b01b62998792f195d6e` proved audible Cue/Hot Cue/Loop/Jog behavior, dual-deck independence, a five-minute 156-wrap loop hold with zero frame discontinuities, 600 ms UI-stall survival, and audible SYNC recovery with zero additional follower seeks.

The tiny browser could not expose Deck B follower counter telemetry. This is treated as an observability limitation rather than a product failure because the same realtime transport engine already passed the B-follower Hot Cue runtime test, and the later proof-surface SHA `2fb5070237a9da8c36812351cde7053ea2aeba38` additionally proved the actual visible Deck B buttons produce `performanceJumpCount +1`, `hotCueTriggerCount +1`, `transportSeekCount +0`, zero new discontinuities, and SYNC recovery.

No realtime deck, transport, or SYNC engine file changed between the physical engine SHA and the proof-surface SHA. The physical report remains historically BLOCKED on direct tiny-browser B telemetry; the module promotion is based on the combined evidence and does not rewrite that report.

## D-0023 — Performance Transport promoted and locked
Status: ACCEPTED

Phase 7 is LOCKED. Cue, eight hot cues, sample-domain loops, beat-derived loops, bounded jog displacement, two-deck independence, UI-stall survival, five-minute loop stability, and SYNC recovery after explicit performance jumps are proven. Continuous platter/scratch synthesis remains explicitly outside Phase 7.

## D-0024 — Channel EQ/filter use native Web Audio render nodes
Status: ACCEPTED FOR PHASE 8

Per-channel trim and EQ/filtering use GainNode and BiquadFilterNode inside the browser audio rendering graph. UI code only schedules AudioParam values; it does not process audio or own timing. This avoids reimplementing standard biquads inside JavaScript while preserving the realtime authority boundary.

## D-0025 — Mixer owns equal-power crossfade and sample-peak limiting
Status: ACCEPTED FOR PHASE 8

The two-input mixer AudioWorklet applies an equal-power crossfader before summing, then master gain, then a sample-peak limiter with instantaneous attack and controlled release, followed by the existing full-scale safety clamp. The limiter is not described as true-peak or mastering processing.

## D-0026 — Mixer / DSP promoted and locked
Status: ACCEPTED

Phase 8 passed T1-T4 on `3c491c1fc37592e16a284676f569afcbe6423bf1` with 30 unit/simulation tests and 29 Chrome runtime/regression tests, then passed physical T5 on the Windows/Chromium/Realtek path.

Physical validation proved channel trim, 3-band EQ, bipolar filters, equal-power crossfader, master control and sample-peak limiting. Controlled overload reached 1.797890 FS before limiting, maximum gain reduction reached 5.538751 dB, post-limiter hard clips remained 0, and output peak was 0.950221.

SYNC and Cue/Hot Cue/Loop/Jog remained functional with DSP active. The 600 ms UI stall added zero A/B/mixer discontinuities and zero transport seeks. The five-minute mixed hold added zero new discontinuities, ended with SYNC locked and stale snapshots at 0, and received human audible confirmation.

Lifetime discontinuity counters at the end were A=2, B=0, mixer=2; the measured five-minute interval itself added 0/0/0 new discontinuities.

## D-0027 — Track Intelligence is advisory and off the realtime path
Status: ACCEPTED FOR PHASE 9

Phase 9 analysis runs in a Web Worker over decoded PCM. It can propose BPM and a beat-phase anchor but cannot own transport, alter deck rate, engage SYNC, or silently change Musical Clock state.

## D-0028 — Deterministic onset/autocorrelation is the Phase 9 reference provider
Status: ACCEPTED FOR PHASE 9

The first intelligence provider uses inspectable energy-onset extraction, tempo autocorrelation, phase estimation and confidence scoring. Meyda/Essentia.js, WASM, ONNX, WebGPU and WebNN remain replaceable future provider candidates rather than prerequisites.
