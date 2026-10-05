# Libertas0 Agent Handoff

## Scope

Work on **SouthPaw302/Libertas0 only** unless the user explicitly changes scope.

All planned phases 0-11 are LOCKED within their recorded scope. Use `main` as authority.

The current baseline includes:
- Validation Fabric v2;
- Linux + Windows hosted core checks;
- full Chromium regression;
- repeated realtime torture;
- exact-SHA evidence packaging;
- the plain Libertas0 Test Console with Fullscreen.

## Latest proven automated baseline

Latest runtime-affecting validated SHA:

`f1a32adc5ba2d57d85a56a8681fa4924e4eb6726`

Full Validation run:

`37272284570`

PASS:
- bootstrap / system / workflow sanity;
- Linux core;
- Windows core;
- **51/51 unit/simulation tests**;
- production build;
- **40/40 Chromium runtime/regression tests**;
- **33/33 repeated high-risk realtime torture tests**;
- evidence aggregation.

Aggregate evidence:
- artifact ID: `11327899791`
- digest: `sha256:668f346e27a38d89cd8b06705deb98e329d2d6de29a69e81f9b94dc8726609a5`

The WebRTC torture harness now allows a bounded 10-second cold-start condition window. This changes test startup tolerance only; role, ordering, continuity, zero-discontinuity, and local realtime-authority assertions remain unchanged.

Later commits may update documentation/evidence only; the validated runtime-affecting SHA above remains the reference until another runtime-affecting Full Validation PASS supersedes it.

## First action in a new session

1. Run `python bootstrap.py` and require `LIBERTAS BOOT: PASS`.
2. Read `.libertas/SECOND_BRAIN.md`.
3. Read `DEVELOPMENT_STATE.json`.
4. Read `VALIDATION_REGISTRY.json`.
5. Read `docs/CROSS_REPO_VALIDATION_FABRIC.md`.
6. Read the relevant module contract before product changes.

## Automated-first proof rule

Before asking the user to perform a test, exhaust:

1. contract/static sanity;
2. unit/simulation;
3. Linux + Windows hosted core checks;
4. full Chromium runtime/regression;
5. focused repeated realtime torture;
6. exact-SHA evidence aggregation.

Only then create a local/physical task, and that task must contain **only** facts hosted automation cannot prove.

Do not ask the user to manually repeat typechecks, unit tests, browser regressions, deterministic synthetic MIDI, generated-audio checks, continuity counters, or other runner-provable work.

## Manual residue

Valid residual gates include:
- human listening judgment;
- physical MIDI/controller interaction;
- real speaker/interface routing;
- browser/device-specific behavior unavailable on hosted runners;
- other genuinely physical hardware facts.

## Cross-repo reuse rule

The wider SouthPaw302 repository ecosystem is a pattern library, not a runtime dependency graph.

The repository-wide scan has already normalized useful ideas from the broader stack into Libertas0: workflow/contract guards, runner runtime proof, Windows validation, browser smoke, workflow sanity, artifact/QC handling, evidence surfacing, and bootstrap/handoff discipline.

Never silently import another project's authority, assumptions, or runtime.

## Operator GUI

Keep the Test Console simple and practical:
- obvious Deck A/B load/play controls;
- SYNC and mixer;
- cue/hotcue/loop/jog;
- recording/replay;
- readable status;
- Fullscreen.

The GUI is an operator surface, never realtime timing authority.

## Current next action

Continue improving **Libertas0 itself**. Use `Libertas0 Full Validation` as the default proof gate. Expand long-duration/randomized bounded torture and evidence visibility where useful while preserving the locked realtime core.
