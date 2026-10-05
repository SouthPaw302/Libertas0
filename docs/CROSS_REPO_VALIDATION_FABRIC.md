# Cross-Repo Validation Fabric for Libertas0

## Purpose

Libertas0 should use the strongest proven development and validation patterns from the wider SouthPaw302 repository ecosystem without creating runtime coupling between projects.

The rule is simple:

**If a result can be proven repeatedly by a runner, browser harness, deterministic fixture, exact-SHA artifact, or machine-readable validator, automate it before asking for a physical/manual test.**

Manual testing remains essential, but only for facts hosted automation cannot actually observe.

## Repository scan

A repository-wide scan was performed across the SouthPaw302 account on 2026-10-05. The scan covered workflows, bootstrap systems, handoffs, smoke tests, evidence/report paths, browser/runtime tests, orchestrators, validation scripts, and artifact conventions.

High-value donor patterns:

| Source | Pattern adopted for Libertas0 |
| --- | --- |
| AIVideoEdit | machine-readable workflow registry; workflow/contract guards; bootstrap-first authority; proof-before-promotion; deterministic selection rather than agent improvisation |
| Argus | real hosted-runtime execution; exact dependency/runtime pinning; checksum verification; resource telemetry; long-running jobs; durable evidence artifacts |
| antibot | workflow-sanity checks; concurrency/cancel-in-progress; smoke-test layering; drift/conformance thinking; avoid wasting expensive jobs on bad workflow plumbing |
| Aurelia | small core gate separated from browser smoke; headless Chromium interaction; console/page-error failure; screenshot evidence |
| LibertasDesktop | Linux/Windows split; Windows as a first-class validation environment; deliberate hosted-runner use; explicit local/manual fallback when hosted execution cannot prove hardware facts |
| Origo | minimal fast CI lane for TypeScript/build health |
| Fidelis | deterministic synthetic-audio smoke; staged orchestrator jobs; content-addressed artifact summaries; QC as a first-class output |
| Pegasus | evidence should be easy to inspect, select, and reason about rather than buried only in logs |
| Libertas0 | exact-SHA local debug bus; immutable promotion evidence; per-module contracts; browser runtime regressions; physical proof only where required |

Other repositories were also scanned. Where current `main` had no reusable validation/handoff infrastructure, nothing was copied simply to claim reuse. The point is to harvest useful patterns, not create cross-project cargo cults.

## What is deliberately not adopted

- No runtime dependency on another repository.
- No network call to another project as part of realtime musical execution.
- No Docker requirement. Some repos use container smoke tests effectively, but Libertas0 does not need Docker to prove its browser/audio core.
- No model or agent is promoted to realtime musical authority.
- No replacement of Libertas0's exact-SHA evidence rules.

## Validation ladder v2

### V0 — Workflow sanity
Before expensive work:
- bootstrap;
- validate JSON/contracts;
- reject malformed workflow hygiene;
- fingerprint the exact SHA and runner.

### V1 — Cross-platform core
Linux and Windows:
- `npm install`;
- TypeScript;
- unit/simulation tests;
- production build.

### V2 — Browser runtime
Chromium:
- full Playwright suite;
- locked-module regressions;
- retain HTML report, traces, screenshots/failure artifacts.

### V3 — Realtime torture
Repeat high-risk suites:
- SYNC;
- performance transport;
- distributed session churn;
- UI/main-thread-stall continuity.

This lane is intended to grow into longer holds and randomized bounded action sequences.

### V4 — Evidence bundle
One exact-SHA bundle must identify:
- commit SHA/ref/run;
- job outcomes;
- runner/platform fingerprints;
- reports and traces;
- artifact names/digests when available;
- explicit limitations.

### V5 — Physical residue
Only after V0-V4 pass, produce a local handoff containing **only the remaining unautomatable facts**, for example:
- audible quality;
- physical MIDI;
- actual audio device routing;
- Opera/Brave/device-specific behavior.

The local operator should never have to repeat a large automated checklist.

## Promotion rule

A green runner is not proof of human-perceived audio quality or physical hardware behavior. A human PASS is not a substitute for deterministic regression evidence.

Promotion uses the union of:
1. automated exact-SHA evidence;
2. explicit residual physical evidence when the contract requires it.

## Future GUI direction

The simple Libertas0 test console should eventually expose an Evidence area inspired by the wider stack: current SHA, latest Full Validation result, failed lane, and links/names for evidence artifacts. The GUI remains an operator surface, never timing authority.
