# Performance Transport Contract v1

## Scope
Phase 7 adds explicit DJ transport actions on top of the proven deck, musical-clock, and SYNC layers:
- cue;
- eight hot cues;
- loops;
- beat-derived loops;
- jog-by-frames / jog-by-time displacement.

It does not add:
- waveform rendering;
- scratch audio synthesis or reverse continuous playback;
- slip mode;
- roll FX;
- quantized launch scheduler;
- EQ/filter/crossfader DSP.

## Authority law
Deck `sourceFrame` remains transport truth.
All performance actions are explicit commands to the existing AudioWorklet deck processor.

No UI timer advances transport.
No hidden worker performs transport seeks.

## Explicit-jump accounting
Performance transport jumps are not SYNC maintenance.

The deck separately exposes:
- `transportSeekCount` for ordinary explicit seek;
- `performanceJumpCount`;
- `cueTriggerCount`;
- `hotCueTriggerCount`;
- `jogCount`.

This separation preserves the Phase 6 no-hidden-seek invariant.

## Cue
- one cue point per deck;
- may be set to any valid source frame;
- `cue-trigger` returns to the cue;
- default cue trigger pauses the deck;
- optional non-pausing cue trigger is an explicit API choice.

## Hot cues
- eight slots;
- each stores one source frame or null;
- triggering a hot cue jumps immediately to its stored frame;
- current play/pause state is preserved.

## Loop
A loop is a half-open interval:
`[loopStartFrame, loopEndFrame)`.

Requirements:
- end > start;
- boundaries are clamped to loaded PCM;
- render-thread wrapping preserves overshoot;
- loop wrap itself is not a frame discontinuity;
- end-of-track does not stop the deck while a valid loop is enabled.

A beat loop is only a deterministic conversion from the existing manual grid into source-frame boundaries.

## Jog
Phase 7 jog is an explicit bounded source-frame displacement.

It is suitable for coarse/fine transport nudging and proof of jog semantics.
It is not marketed as scratch emulation; continuous reverse/scratch rendering is future work.

## SYNC interaction
A user-triggered cue/hotcue/jog on a follower may deliberately disturb phase.
SYNC may subsequently re-lock using its proven rate controller.
SYNC must not convert that recovery into a hidden transport seek.

## Gates

### T1 unit
- frame clamping;
- loop validation;
- overshoot-preserving wrapping;
- render-block partition invariance.

### T3 integration/runtime
- cue set/return;
- hotcue set/trigger;
- loop wraps repeatedly with 0 new worklet discontinuities;
- beat loop boundaries match musical-clock frames;
- loop survives 600 ms blocked main thread;
- jog clamps and preserves play state;
- explicit follower hotcue increments performanceJumpCount but not transportSeekCount;
- SYNC continues tracking/relocks afterward;
- all locked lower regressions remain green.

### T5 local physical
- audible cue/hotcue jumps;
- audible loop start/end quality;
- loop hold >=5 minutes;
- jog controls while playing;
- controls while two decks run;
- 600 ms stress inside active loop;
- verify no unexpected clicks/dropouts/stalls and no hidden SYNC seek.

Phase 7 cannot be LOCKED before T5 PASS.
