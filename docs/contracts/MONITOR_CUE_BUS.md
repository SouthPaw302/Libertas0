# Monitor / Cue Bus Contract

## Module

Module 12 — `monitor-cue-bus`.

## Goal

Add the missing DJ monitoring/prelisten path:

- Cue A / Cue B selection;
- dedicated monitor/headphone bus;
- equal-power Cue ↔ Master blend;
- monitor level;
- selectable browser audio output when `HTMLMediaElement.setSinkId()` is available.

## Signal boundary

Cue path:

**deck → channel trim/EQ/filter → cue tap → monitor bus**

Master path remains:

**deck → channel trim/EQ/filter → mixer crossfader → master → limiter → master output**

The monitor's master feed is tapped post-limiter.

Consequences:
- Cue hears channel trim/EQ/filter.
- Cue ignores crossfader and master volume.
- Master-monitor feed reflects the actual post-master signal.
- Monitor routing never owns deck transport, Musical Clock, SYNC, or render timing.

## Monitor graph

Cue A and Cue B have independent selectors. With both selected the cue sum is normalized by `1/sqrt(2)`.

Cue/Master blend is equal-power:
- 0 = cue only;
- 0.5 = equal-power cue + master;
- 1 = master only.

The final monitor level is 0..1.

The monitor bus terminates in a `MediaStreamAudioDestinationNode` feeding an `HTMLAudioElement`. Browsers supporting `setSinkId()` can send this element to a separate headphone/audio output while the master AudioContext remains unchanged.

## Authority boundary

This module may not:
- alter deck `sourceFrame`;
- seek or rate-correct a deck;
- synthesize a musical clock;
- alter SYNC phase/correction;
- move loop/cue/hotcue timing;
- use UI/browser timers as realtime audio authority.

## Required gates

- unit: blend and cue normalization;
- integration: cue independence from crossfader/master and no transport side effects;
- runtime: monitor graph and optional sink capability surface in Chromium.

Physical multi-output/headphone selection is browser/OS/device dependent. It is useful to verify when hardware is available but is not required to prove deterministic software routing.

## Non-goals

- booth output;
- split-cue left/right;
- multiple independent headphone mixes;
- native ASIO/CoreAudio/WASAPI exclusive routing;
- hardware-interface certification.
