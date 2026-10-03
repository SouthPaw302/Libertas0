# Libertas0 Development Plan

## Current order
0. Development OS
1. Runner/debug/orchestration fabric
2. Realtime audio kernel
3. Deck A + volume
4. Deck B + volume + mixer
5. Musical clock + manual grids
6. SYNC research, candidates, and torture gate
7. Cue/loops/jog/performance
8. Mixer/DSP expansion
9. Intelligence
10. Library/MIDI/recording/automation
11. Distributed system

## Rule
Do not move upward because a schedule says so. Move upward only when the current module's evidence gate passes.

## Branching
- `main`: promoted system authority and proven work.
- `system/<name>`: bounded development-system work.
- `module/<name>`: bounded product module work.
- `research/<topic>`: bounded research/prototypes.
- `validation/local-debug`: local-agent evidence only.
- `validation/<gate>`: bounded automated/runtime evidence.

## Commit discipline
Prefer meaningful checkpoints. Avoid micro-push loops. A commit should represent a coherent state another developer can understand and test.
