# Libertas0 Agent Handoff

## Scope

Work on **SouthPaw302/Libertas0 only** unless the user explicitly changes scope.

All planned phases 0-11 are locked within their recorded scope. The current authority is `main`.

The post-lock validation fabric and simple operator test console are now integrated into main.

## Proven automated baseline

Validated system/product baseline SHA:

`670887b4cc6bb4b139e2dd760c66075591c223f7`

Full Validation run: `37271806628`

PASS:
- bootstrap / system / workflow sanity;
- Linux core check;
- Windows core check;
- 51 unit/simulation tests;
- production build;
- full Chromium regression: **40/40 PASS**;
- repeated high-risk realtime torture: PASS;
- exact-SHA evidence aggregation: PASS.

Aggregate evidence artifact:
- ID: `11328224800`
- digest: `sha256:9e7d06223d5cd5e71e0ec3c06984af155a504196c83a72ced9d75a61eefd68bd`

The simple test console is part of this proven baseline. It includes the Fullscreen control and preserves the existing test/control IDs.

## First action in a new session

1. Run `python bootstrap.py`.
2. Read `.libertas/SECOND_BRAIN.md`.
3. Read `DEVELOPMENT_STATE.json`.
4. Read `VALIDATION_REGISTRY.json`.
5. Read `docs/CROSS_REPO_VALIDATION_FABRIC.md`.
6. Read the relevant module contract before product changes.

## Automated-first proof rule

Before asking the user to perform a test, exhaust the repeatable automated proof surfaces:

1. contract/static sanity;
2. unit/simulation;
3. Linux + Windows hosted core checks;
4. full Chromium runtime/regression;
5. focused realtime torture;
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

Useful patterns have been normalized into Libertas0 from multiple projects: contract/workflow guards, exact-runtime evidence, Windows validation, browser smoke, workflow sanity, artifact/QC handling, and inspectable evidence concepts.

Never silently import another project's authority, assumptions, or runtime.

## Current next action

Use `main` as authority. Keep Libertas0 automated-first and keep the operator GUI plain, practical, and test-focused. Future changes must pass `Libertas0 Full Validation` before any residual physical gate is requested.
