# Phase 1 — Execution and Verification Fabric

## Objective
Make testing, delegation, local debugging, and evidence transfer deterministic before product modules exist.

## Required pieces
- boot/session attestation;
- machine-readable task/result schemas;
- GitHub Actions system-contract gate;
- evidence-only local-debug report branch;
- runner-backed relay into issue #1;
- report validation before relay;
- artifact upload;
- exact-SHA test requests and results.

## Debug-bus law
The local agent is a test/execution node, not repository authority.

Every request names task ID, exact SHA, branch, module, objective, bounded scope, steps, evidence required, and stop conditions.

Every result names task ID, exact tested SHA, environment, PASS/FAIL/BLOCKED, measurements, artifacts/logs, and reproduction notes.

## Phase 1 gate
Run a synthetic report through the same branch + Action + issue relay used later by the real local agent.

PASS requires:
1. report branch changes only `reports/local-debug/**`;
2. report schema validates;
3. Action completes;
4. artifact package is retained;
5. issue #1 receives the exact report SHA and tested SHA.

Only after this passes do we send the first real-machine assignment.
