# Module 18 — AutoMix / Transition Intelligence (Contract Draft)

Status: CONTRACT DRAFT; product code NOT AUTHORIZED until mandatory bootstrap, state/registry update, and contract review.
Base SHA: `734c275e792252e5ccdd9e4440d5aa5f8eaaa37f`
Branch: `module18-automix-transition`

## Mission
Create explainable, deterministic transition planning and assisted execution for Deck A/B using Module 17 preparation, Track Intelligence, Musical Clock, SYNC, mixer and FX. Never replace the realtime audio kernel.

## Authority and safety
- Audio engine/Musical Clock own sample-accurate scheduling and phase; AutoMix proposes intents, not a JS timer clock.
- Automation may not secretly seek, overwrite manually set cues, silently switch SYNC master, or mutate prepared-library data.
- Human deck, mixer, FX, MIDI actions override automation immediately; cancellation is bounded, observable and audible-safe.
- Unsupported/incompatible/low-confidence grids yield explicit NO_PLAN or MANUAL_REQUIRED, not an invented alignment.
- Initial scope: offline/deterministic planner plus opt-in assisted transition; no autonomous playlist mixing or ML dependency.

## Planned contract
Input: current/next deck IDs, loaded source identities, prepared cues/grid, BPM and grid confidence, Musical Clock snapshots, phrase length/target, user-selected transition length (bars), available mixer/FX capability.
Output: immutable TransitionPlan containing plan ID, source identities, assumption/confidence diagnostics, downbeat/beat target, bounded tempo compatibility, suggested entry/exit cues, duration in beats, gain/EQ/crossfader curve envelopes, requested engine actions, explicit refusal reasons.
Execution: compare observed track identities and Musical Clock state to plan assumptions before arm/execute; hand plan to existing audio-timeline/automation engine; observe execution telemetry. No setTimeout/requestAnimationFrame driven beat scheduling.
State machine: IDLE -> PLANNED -> ARMED -> EXECUTING -> COMPLETED; ABORTED or REFUSED on mismatch/manual override/stale plan; no automatic retry.
Phase-aware behavior: prefer prepared phrase/cue boundaries when available; state fallback precisely if musical phrase evidence is unavailable.
Transitions: equal-power crossfade as baseline; constrained EQ/gain and optional existing FX automation, zero surprise effects.

## Acceptance gate (all evidence exact product SHA)
1. Bootstrap: `python bootstrap.py` prints `LIBERTAS BOOT: PASS`.
2. Contract/system validation and Linux + Windows typecheck/unit/build.
3. Planner unit cases: aligned and incompatible BPM; confident and missing/stale grids; saved cues; bar boundaries; track replacement; deterministic replay; refusal paths.
4. Browser: arm, transition on two real decoded tracks, manual override, cancellation, no broken controls; verify timing via audio-engine counters, not only UI.
5. Regression: SYNC hold, deck jog/loops, mixer/FX/recording, prepared-library restoration; zero new hidden seeks and frame discontinuities.
6. Evidence bundle: exact SHA, runner details, plan/execution trace, observations and PASS/FAIL. Human listening only for any remaining subjective physical gate.
7. No promotion to main until required gate PASS; preserve locked Module 17 exactly.

## Working sequence
A. Runner/bootstrap and register Module 18 contract.
B. Pure planner + deterministic unit suite.
C. Audio-timeline execution adapter and manual override.
D. Browser integration and bounded torture.
E. Single end-of-module Full Validation, evidence and promotion.
