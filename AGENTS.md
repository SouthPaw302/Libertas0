# Libertas0 Universal Agent Contract

Applies to every human developer, coding agent, research agent, automation, runner, browser worker, and local debug agent.

## Mandatory boot
Before making a development decision or changing code:

```bash
python bootstrap.py
```

Do not begin development unless bootstrap prints `LIBERTAS BOOT: PASS`.

Then read:
1. `SOUL.md`
2. `.libertas/SECOND_BRAIN.md`
3. `DEVELOPMENT_STATE.json`
4. the active module contract/evidence referenced by state

## Authority
1. Current explicit user instruction.
2. Machine-readable repository state/contracts on the active branch.
3. `SOUL.md` and this file.
4. Current accepted evidence and decisions.
5. Historical material only as reference.

## Development law
- Work only on the active module unless the user explicitly changes scope.
- Use bounded development branches for product modules.
- `validation/local-debug` is evidence-only and must never patch product/system code.
- Do not claim browser/audio/hardware success without the required runtime evidence.
- Do not introduce a dependency, model, framework, or runtime merely because it exists.
- Research when implementation choice is materially uncertain or current technology may have changed.
- Preserve failed approaches in `FAILURES.md`.
- Record architectural decisions in `DECISIONS.md`.
- Update `DEVELOPMENT_STATE.json` when module state changes.

## Realtime law
The deterministic realtime engine owns musical execution. React, timers, agents, inference, filesystem, network, CI, and persistence may request actions but cannot become the clock.

## Delegation
The master developer may allocate bounded tasks to research workers, coding workers, GitHub runners, browser/runtime workers, and the local debug agent through GitHub issue #1 plus `validation/local-debug`.

Every task and result must follow the schemas in `orchestrator/`.

## Promotion
A module moves to PROVEN only when all required gates in `SYSTEM_CONTRACT.json` pass with recorded evidence.
A regression moves the module to REGRESSION and blocks dependent promotion.
