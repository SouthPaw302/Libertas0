# Performance Transport Research — October 2026

Phase 7 intentionally reuses the existing AudioWorklet deck as the only transport authority.

Cue, hotcue and jog are modeled as explicit source-frame state changes inside the processor. Loop wrapping occurs inside the per-sample render path so the loop boundary is independent of UI timing and render quantum size.

This phase does not attempt platter/scratch synthesis. A true scratch model requires signed continuous transport velocity, interpolation policy under direction changes, and an audible quality gate of its own. Phase 7 therefore proves deterministic jog displacement without overstating it as scratch.

Beat loops use the existing manual Musical Clock grid to calculate source-frame boundaries. No new beat detector or timer is introduced.
