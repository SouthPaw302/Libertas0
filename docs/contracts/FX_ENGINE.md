# FX Engine Contract

## Module

Module 14 — `fx-engine`.

## Goal

Add usable realtime DJ effects without moving transport or SYNC authority into the effects/control layer.

Implemented buses:
- Deck A FX;
- Deck B FX;
- final Master FX.

Each FX unit provides:
- equal-power wet/dry;
- beat-synced delay time;
- bounded feedback;
- feedback tone filtering.

## Signal routing

Deck path:

**deck → channel trim/EQ/filter → deck FX → mixer/crossfader/master/limiter**

Monitor cue remains tapped from the channel strip before Deck FX.

Master path:

**mixer limiter output → master FX → physical master output**

Master monitor feed and Master Recording both tap the final Master FX output.

## Beat timing

Delay time is:

`(60 / effectiveBpm) × beatFraction`

where:

`effectiveBpm = MusicalClock grid BPM × actual deck playbackRate`

Supported beat fractions:
- 1/8 beat;
- 1/4 beat;
- 1/2 beat;
- 1 beat;
- 2 beats;
- 4 beats.

Deck A and Deck B derive tempo independently from their own grid/rate state.

Master FX has an explicit Deck A or Deck B tempo source.

## Realtime authority

The effect graph runs entirely in Web Audio nodes.

The control plane may read deck status and update effect AudioParams, but FX may never:
- seek or change a deck source frame;
- own Musical Clock phase;
- apply SYNC corrections;
- trigger performance transport;
- derive transport timing from browser timers;
- feed timing corrections into deck or SYNC modules.

A throttled or blocked UI may delay a future FX parameter update, but must not interrupt already-running audio or transport.

## Wet/dry

Wet/dry uses equal-power gains:
- wet 0 = fully dry;
- wet 0.5 = equal-power dry + wet;
- wet 1 = fully effected path.

## Feedback

Feedback is bounded to 0..0.85 to prevent an unbounded feedback loop.

## Tone

The feedback low-pass tone control maps logarithmically from approximately 800 Hz to 18 kHz.

## Recording

Master Recording taps the final Master FX output. Recordings therefore represent the final processed master signal rather than the pre-FX mixer output.

## Required gates

- unit: wet/dry law, beat-delay math, effective tempo, tone mapping;
- integration: deck/master routing and final-master recording;
- runtime: active effects survive a 600 ms blocked main thread with no new deck/mixer discontinuities;
- locked mixer/SYNC/performance regressions.

## Non-goals

- VST/AU plugin hosting;
- convolution reverb;
- multi-slot arbitrary FX chains;
- native hardware DSP;
- transport authority;
- automated effect-selection intelligence.
