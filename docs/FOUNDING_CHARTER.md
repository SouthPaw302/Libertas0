# Libertas0 Founding Charter

## Goal
Libertas0 is a current-generation music-performance platform built together with a persistent development operating system.

The first non-negotiable product is:

**Deck A + Deck B + independent volume control + stable simultaneous playback + precise synchronization under active performance use.**

The repository coordinates humans, agents, runners, browser tests, research, local hardware testing, artifacts, decisions, failures, and module promotion.

## Development OS
The repository must always answer:
- What are we building?
- What is authoritative?
- What currently works?
- What is being changed?
- What failed?
- What must be proven next?
- Which execution/testing capabilities are available?

Canonical state:
- `SOUL.md`
- `AGENTS.md`
- `SYSTEM_CONTRACT.json`
- `CAPABILITY_REGISTRY.json`
- `MODULE_REGISTRY.json`
- `DEVELOPMENT_STATE.json`
- `DECISIONS.md`
- `FAILURES.md`
- generated `.libertas/SECOND_BRAIN.md`

## Orchestration
The master developer owns architecture, integration, current module state, and promotion.

Master loop:
**Understand -> Allocate -> Delegate -> Collect -> Integrate -> Verify -> Promote**

Workers are bounded:
- research worker;
- coding worker;
- GitHub runner;
- browser/runtime worker;
- local debug agent.

## Runner-backed local debug bus
GitHub issue #1 is the shared handoff channel.
The local debug agent works from exact SHAs and returns durable evidence through `validation/local-debug`.
The report branch never changes product/system code.

Flow:
**master -> exact SHA/test request -> local agent -> report branch -> runner relay -> issue #1 -> master**

## Technical direction
- TypeScript for application/control architecture.
- React + Vite for UI, never realtime authority.
- AudioWorklet as the initial browser realtime execution boundary.
- WebAssembly is a candidate implementation tool where profiling/proof justifies it.
- SharedArrayBuffer + Atomics are used when isolation/support is proven; message passing is the fallback.
- Web Workers handle non-realtime decode/analysis/background work.
- ONNX/WebGPU/WebNN/NPU paths are capability-driven analysis/inference providers, never realtime musical authority.
- Native execution may exist behind explicit contracts, never as a hidden competing clock.

## Development sequence
0. Development OS
1. Execution and verification fabric
2. Realtime audio kernel
3. Deck A + Volume A
4. Deck B + Volume B + mixer
5. Musical clock + manual beat grid
6. SYNC research/candidates/torture gate
7. Performance transport
8. Mixer/DSP
9. Track intelligence
10. Library/MIDI/recording/automation
11. Distributed Libertas

## Test hierarchy
T1 unit -> T2 simulation -> T3 integration -> T4 runtime -> T5 physical/local.

Passing T1-T3 never implies T5.

## Definition of first major success
Two loaded tracks can be independently controlled and synchronized while actively manipulated, and the repository can prove the exact revision, runtime, measurements, and local evidence behind that claim.
