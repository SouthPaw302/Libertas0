# Libertas0 Agent Handoff

## Scope

Work on **SouthPaw302/Libertas0 only** unless the user explicitly changes scope.

All planned phases 0-11 are LOCKED within their recorded proven scope.

The current `main` baseline includes:
- Validation Fabric v2;
- cross-platform Linux + Windows core validation;
- full Chromium regression;
- repeated realtime torture;
- exact-SHA evidence packaging;
- the plain operator-friendly Libertas0 Test Console with Fullscreen.

## First action

1. Run `python bootstrap.py` and require `LIBERTAS BOOT: PASS`.
2. Read `.libertas/SECOND_BRAIN.md`.
3. Read `DEVELOPMENT_STATE.json`.
4. Read `VALIDATION_REGISTRY.json`.
5. Read `docs/CROSS_REPO_VALIDATION_FABRIC.md`.
6. Read the relevant module contract before changing product code.

## Automated-first proof rule

Before asking the user to perform a test, exhaust the repeatable automated proof surfaces:

1. bootstrap / contract / workflow sanity;
2. Linux + Windows core checks;
3. full Chromium runtime/regression suite;
4. focused repeated realtime torture;
5. exact-SHA evidence bundle.

Only then create a local/physical task, and that task must contain **only** facts hosted automation cannot actually prove.

Do not ask the user to manually repeat typechecks, unit tests, browser regressions, deterministic continuity counters, synthetic MIDI, generated-audio checks, or other runner-provable work.

## Physical/manual residue

Appropriate residual gates include:
- human listening and subjective audio quality;
- physical MIDI/controller interaction;
- real speaker/interface routing;
- browser/device-specific behavior unavailable on hosted runners;
- other genuinely physical hardware facts.

## Cross-repo reuse rule

The wider SouthPaw302 GitHub stack is a **pattern library**, not a dependency graph.

Useful patterns have already been normalized into Libertas0 from AIVideoEdit, Argus, antibot, Aurelia, LibertasDesktop, Origo, Fidelis, Pegasus, and other scanned repositories where applicable.

Borrow ideas only when they preserve Libertas0's contracts. Never silently import another repository's runtime authority, assumptions, or state.

## Current operator surface

The Test Console is intentionally simple. It exists for direct listening and physical checks, not as a polished product GUI.

Keep:
- obvious Deck A/B load/play controls;
- SYNC and mixer access;
- cue/hotcue/loop/jog access;
- recording/replay;
- readable status panels;
- Fullscreen.

Do not make UI timers or the GUI a realtime authority.

## Current next action

Continue hardening **Libertas0 itself**.

Use `Libertas0 Full Validation` as the default proof gate for repeatable changes. Expand long-duration/randomized bounded torture and evidence visibility where useful, while preserving the locked realtime core.
