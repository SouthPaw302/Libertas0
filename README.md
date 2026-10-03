# Libertas0

Libertas0 is a ground-up, modular music-performance system and its development operating system.

The first product goal is deliberately narrow:

**Deck A + Deck B + independent volume control + stable simultaneous playback + precise synchronization under active performance use.**

The repository is also the durable memory and coordination surface for human developers, agents, GitHub Actions/runners, browser test workers, and the local debug agent.

## Start here

1. Run `python bootstrap.py`.
2. Read `SOUL.md`.
3. Read the generated `SECOND_BRAIN.md`.
4. Read `DEVELOPMENT_STATE.json`.
5. Work only on the current module and its explicit gate.

See `docs/FOUNDING_CHARTER.md` for the complete development architecture.

## Core rule

A module is not finished because code exists or tests are green. It is finished only when its required proof gate is satisfied and its evidence is recorded.
