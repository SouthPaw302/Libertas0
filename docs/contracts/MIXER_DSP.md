# Mixer / DSP Contract v1

## Scope
Phase 8 replaces the primitive Phase 4 summing stage with a deterministic DJ mixer signal path while preserving all locked transport and SYNC behavior.

Per-channel signal path:

```text
Deck PCM output
  -> trim (-12..+12 dB)
  -> low shelf EQ @ 120 Hz (-24..+6 dB)
  -> mid peaking EQ @ 1 kHz, Q 0.8 (-24..+6 dB)
  -> high shelf EQ @ 8 kHz (-24..+6 dB)
  -> bipolar DJ filter
  -> mixer input
```

Master signal path:

```text
channel A/B
  -> equal-power crossfader
  -> sum
  -> master volume
  -> sample-peak limiter
  -> final full-scale safety clamp
  -> output
```

## Realtime law
Channel DSP uses native Web Audio render nodes (GainNode/BiquadFilterNode). Parameter changes are scheduled on the AudioContext timeline. UI events only request parameter values; UI timers do not process audio.

Crossfader, summing, limiter, overload accounting and final safety clamp execute inside the mixer AudioWorklet.

## EQ
Phase 8 EQ is a 3-band tone-shaping EQ, not a full-kill isolator:
- low shelf: 120 Hz
- mid peaking: 1 kHz, Q 0.8
- high shelf: 8 kHz
- range: -24 dB to +6 dB

## Bipolar filter
Control range is [-1, 1]:
- 0: broad-pass neutral state;
- negative: progressively lowers a low-pass cutoff down to about 80 Hz;
- positive: progressively raises a high-pass cutoff up to about 12 kHz.

Cutoff mapping is logarithmic and uses the actual runtime sample rate.

## Crossfader
Equal-power law:
- -1: A=1, B=0
- 0: A=B=sqrt(1/2)
- +1: A=0, B=1

No custom curve/cut-lag setting is claimed in Phase 8.

## Limiter
Phase 8 provides a sample-peak safety limiter, not true-peak mastering.

Default:
- threshold 0.98 FS;
- instantaneous gain reduction when a sample exceeds threshold;
- 80 ms release toward unity;
- final safety clamp remains after the limiter.

Telemetry includes:
- pre-limiter summed peak;
- samples exceeding full scale before limiting (`clippedSamples`, retained for Phase 4 compatibility);
- limited sample count;
- current limiter gain;
- current/max gain reduction dB;
- post-limiter hard-clipped sample count.

A successful limiter gate requires overload reduction without post-limiter hard clipping.

## Gates

### T1 unit
- dB conversion;
- equal-power crossfader endpoints/center;
- logarithmic bipolar filter mapping;
- runtime sample-rate adaptation;
- bounds validation.

### T3/T4 browser
- independent channel trim;
- low/mid/high EQ attenuation and boost against corresponding test tones;
- low-pass/high-pass filter attenuation;
- equal-power crossfader telemetry and endpoint isolation;
- limiter overload reduction with zero post-limiter hard clipping;
- 600 ms main-thread stall under active DSP with zero new A/B/mixer discontinuities;
- every locked audio/deck/clock/SYNC/performance-transport regression remains green.

### T5 local physical
On exact T4 SHA:
- ordinary music on both decks;
- independently sweep trim/EQ/filter;
- sweep crossfader A -> center -> B;
- create controlled overload and confirm limiter behavior without harsh hard clipping;
- run SYNC and performance transport while DSP is active;
- 600 ms UI stall;
- at least five minutes of mixed playback;
- human listening for zipper noise, clicks, unexpected level jumps, filter/EQ instability or dropouts.

Phase 8 cannot be LOCKED before T5 PASS.
