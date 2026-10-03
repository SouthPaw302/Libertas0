# Deck B + Mixer Research — October 2026

Phase 4 deliberately introduces no new decode or transport technology.

The proven deck transport is generalized into one instantiable controller and used for both A and B. Each AudioWorkletNode instance owns separate processor state while sharing the same AudioContext timeline.

The mixer is a separate two-input AudioWorklet rather than main-thread Web Audio gain arithmetic. This keeps summing, master automation, overload accounting, and continuity telemetry on the realtime render path.

No SYNC, beat grid, time-stretch, crossfader law, EQ, or effects are introduced here. They depend on proving two independent simultaneous decks first.
