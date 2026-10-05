# Libertas0 Master Orchestrator

The master developer owns architecture, integration, current module state, and promotion.

Loop: **Understand -> Allocate -> Delegate -> Collect -> Integrate -> Verify -> Promote**

Workers: research, coding, runner, browser/runtime, and local debug.

Every delegated task follows `TASK_SCHEMA.json`.
Every returned result follows `RESULT_SCHEMA.json`.

The orchestrator never treats worker opinion as proof when objective evidence is required.

## Proof allocation order

Use the cheapest authoritative proof first:

**contract/static -> unit/simulation -> hosted runner -> browser runtime -> realtime torture -> local debug -> human/physical**

Do not send repeatable checks to the human operator merely because a local-debug gate exists. Hosted runners and browser harnesses must exhaust what they can prove first.

The physical/local gate is a **residual gate**. It contains only facts automation cannot observe, such as human listening, physical MIDI, real device routing, or browser/device behavior unavailable on the runner.

## Validation registry

`VALIDATION_REGISTRY.json` defines reusable validation profiles.

`docs/CROSS_REPO_VALIDATION_FABRIC.md` records the cross-repository patterns normalized into Libertas0.

Cross-repo projects are pattern sources only. Libertas0 must not acquire hidden runtime authority or dependencies from them.
