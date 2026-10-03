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
