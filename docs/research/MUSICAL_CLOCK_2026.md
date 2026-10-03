# Musical Clock Research — October 2026

## Realtime anchor
Web Audio's AudioWorklet render scope exposes the current sample frame and associated context sample rate. Web Audio 1.1 continues to define rendering in sample-frame blocks and an ever-increasing render timeline.

References:
- https://webaudio.github.io/web-audio-api/
- https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope/currentFrame
- https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope/sampleRate

## Libertas0 decision
Phase 5 does not create a wall-clock or JavaScript timer.

The proven deck already owns `sourceFrame` on the realtime render path. Musical time is therefore modeled as an exact deterministic coordinate system over source frames.

This avoids:
- timer drift;
- duplicate transport authority;
- tying beat phase to UI polling frequency;
- accumulating beat counters iteratively.

## Fixed manual grid first
Automatic BPM/downbeat analysis is intentionally excluded. A manually supplied fixed-BPM grid provides ground truth for the future SYNC module.

Later analysis systems may propose grid values, but the grid contract remains deterministic and inspectable.

## Future extensibility
The fixed-grid API is intentionally isolated. Variable-tempo/warped beat maps can later implement the same conceptual source-frame <-> musical-position contract without changing Deck A/B transport authority.
