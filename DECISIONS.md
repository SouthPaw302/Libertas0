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
