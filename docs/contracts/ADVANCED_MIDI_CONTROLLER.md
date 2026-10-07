# Advanced MIDI / Controller Layer Contract

## Module

Module 16 — `advanced-midi-controller`.

## Goal

Turn the original deterministic MIDI mapping layer into a practical controller system without giving MIDI authority over realtime transport or SYNC timing.

## Capabilities

- multiple simultaneous Web MIDI inputs;
- optional per-binding input-device identity;
- MIDI learn against any input, a selected input, or the next physical source device;
- named controller profiles;
- persistent profile storage;
- profile activation/replacement;
- MIDI output enumeration;
- LED/value-ring feedback mappings;
- richer target catalog spanning mixer, decks, performance transport, SYNC, FX, sampler, and monitor cue.

## Profile model

A profile stores:
- name/id;
- MIDI input bindings;
- MIDI feedback/output rules;
- created/updated timestamps.

Profiles persist in local storage under `libertas0-midi-profiles-v1`.

Activating a profile atomically replaces the current mapping and feedback sets.

## Multi-device behavior

A binding may specify `inputId`.

When present, that binding only responds to MIDI messages from the named physical input. This allows two connected controllers to send the same channel/CC/note without collisions.

Bindings without `inputId` remain global for backward compatibility.

## Target classes

Supported targets include:
- mixer crossfader/master;
- Deck A/B trim/filter/volume;
- Deck A/B play-pause, cue, Hot Cue 1;
- SYNC A→B / B→A / disable;
- Deck A/B/Master FX wet;
- Monitor Cue A/B toggles;
- Sampler pads 1–8 trigger;
- Sampler pads 1–8 gain.

All targets call the existing proven module controllers.

## MIDI output / LED feedback

Feedback rules may emit:
- scaled CC values;
- binary CC/note values;
- short note/CC pulses for trigger actions.

A feedback rule may address one output by ID or all currently connected outputs.

Physical output is best-effort. Missing/disconnected hardware may drop LED feedback but may never block or alter audio/transport behavior.

## Authority boundary

MIDI is a control-plane input/output layer only.

It may request actions from proven modules, but it may never:
- own deck sourceFrame;
- own Musical Clock phase;
- become SYNC correction authority;
- schedule audio from wall-clock UI time;
- become a render clock;
- block the realtime AudioWorklet path while waiting for devices or output feedback.

MIDI LED timing is cosmetic and explicitly non-authoritative.

## Required gates

- unit: device-specific binding isolation, source-device learning, profile persistence, LED/value message generation;
- integration: richer MIDI targets drive mixer/FX/sampler deterministically;
- runtime: profile controls exist and mappings do not introduce deck/mixer discontinuities;
- locked sampler/FX/mixer/transport/SYNC regressions.

## Residual physical checks

Real hardware MIDI input/output/LED behavior varies by browser, OS, device permissions, controller firmware, and attached hardware.

Physical hardware remains an optional compatibility check, not a software-module blocker.
