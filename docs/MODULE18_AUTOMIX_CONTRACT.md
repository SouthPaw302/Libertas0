# Module 18 — AutoMix / Transition Intelligence (LOCKED)

## Exact proof
- Proven product SHA: `800413053151cd7ba8a4eb98a5734db7079bfb4e`
- Final GitHub Actions run: `37716733491` — all seven jobs PASS; Linux and Windows each 81 unit; focused Chromium 20/20; complete Chromium 74/74; realtime repeated torture 33/33.
- Local physical task: `AUTOMIX-T5-001` via handoff `a02c818cffc1fd55297a8e851a89b057d76739da`, report `a629725dec3f4cabdd5ed333219f2c737ac30829`. Installed headed Edge; 2 A→B and 2 B→A actual audible transitions, manual override/refusal PASS, zero unexpected hidden transport seeks, zero A/B/mixer discontinuities, 64.33-second post-master recording on Drive.
- Durable closeout report: `evidence/automix/module18-closeout/RESULT.json`.

## Runtime scope
Module 18 is an *opt-in assisted crossfader transition* subsystem. The deterministic planner proposes a phrase-bar boundary based on **trusted existing beat grids** and confirms tempo/meter and sufficient track length. The operator loads and starts both tracks, engages the proven SYNC engine and stages the crossfader on the outgoing deck. AutoMix checks identities and lock state, then schedules existing mixer AudioParam crossfader automation on the AudioContext timeline, not JavaScript wall-clock timers. Manual deck/performance/crossfader actions cancel the plan or fade, retaining operator authority. Untrusted grids, mismatched sources, incompatible tempo/meter or unstaged crossfader must refuse, never guess.

## Authority and invariants
- Deck AudioWorklets, Musical Clock and SYNC exclusively own realtime source-frame and phase/correction authority.
- No hidden seek, unannounced performance jump, change of SYNC master, or implicit library preparation modification.
- Cancellation and manual override remain immediate and observable; no delayed re-arm of an aborted plan.
- Realtime regressions continue to require zero new A/B/mixer discontinuities and zero hidden maintenance seeks.
- The locked Module 17 library and every previous proven module must remain unchanged.

## Proven acceptance
Hosted exact-SHA build, unit, Chromium runtime/real-time torture; installed-headed-Edge local real-WAV audible transitions in both directions, refusal and manual cancellation, source analysis, post-master recording, Drive-backed runtime JSON, validated bridge report. This is the scope of Module 18's proof, not a broad claim about autonomous DJ capabilities.

## Non-goals / future upgrade
Fully autonomous playlist AutoMix, EQ/FX/gain automation choreography, semantic musical phrase/energy/harmonic inference, automatic loading or start-of-track playback, warp/time-stretch and multi-device physical compatibility remain outside the locked scope.

DJtest integration is a later **surgical compatibility project**: compare old web architecture to these validated modules, preserve features already working, and perform a bounded tested replacement of deficient components. Do not touch DJtest during Module 18 closeout.
