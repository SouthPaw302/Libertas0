# Libertas0 Agent Handoff

## Scope

Work on **SouthPaw302/Libertas0 only** unless the user explicitly changes scope.

Product authority is `main` at the last locked Phase 11 line. All planned phases 0-11 are locked within their recorded scope.

Current post-lock hardening work:
- validation fabric: `system/validation-fabric-v2`;
- simple operator/test GUI: `ui/test-console`.

Do not redirect work into other DJ repositories from this handoff.

## First action

1. Run `python bootstrap.py`.
2. Read `.libertas/SECOND_BRAIN.md`.
3. Read `DEVELOPMENT_STATE.json`.
4. Read `VALIDATION_REGISTRY.json`.
5. Read `docs/CROSS_REPO_VALIDATION_FABRIC.md`.
6. Read the relevant module contract before product changes.

## Automated-first proof rule

Before asking the user to perform a test, exhaust the repeatable automated proof surfaces:

1. system/bootstrap/contract sanity;
2. cross-platform core check;
3. full Chromium runtime/regression suite;
4. focused realtime torture;
5. exact-SHA evidence bundle.

Only then create a local/physical task, and that task must contain **only** facts that hosted automation cannot prove.

Do not ask the user to manually repeat typechecks, unit tests, browser regressions, continuity counters, deterministic synthetic MIDI, generated-audio analysis, or other runner-provable checks.

## Manual residue

Valid examples:
- human listening judgment;
- physical MIDI/controller interaction;
- real speaker/interface routing;
- browser/device-specific behavior unavailable on runners;
- other genuinely physical hardware state.

## Cross-repo reuse rule

The wider SouthPaw302 stack is a pattern library, not a dependency graph. Borrow validated ideas, normalize them into Libertas0 contracts, and record why they were adopted. Never silently import another repo's authority, assumptions, or runtime.

## Current next actions

1. Make `Libertas0 Full Validation` green on `system/validation-fabric-v2`.
2. Preserve exact-SHA evidence from that run.
3. Finish validation of `ui/test-console`; keep the GUI plain and operator-friendly.
4. After both are green, promote the infrastructure/UI changes without weakening any locked realtime contract.
