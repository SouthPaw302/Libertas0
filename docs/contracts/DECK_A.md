# Deck A Contract v1

## Responsibility
Deck A owns exactly one decoded PCM source and its deterministic transport state.

Required:
- load/decode encoded audio;
- mono/stereo PCM;
- play;
- pause;
- seek;
- source-frame position;
- playback rate;
- volume;
- mute;
- clean end-of-track state.

Not owned yet:
- beat grid;
- SYNC;
- cue/hotcue;
- loops;
- jog/scratch;
- tempo-preserving time stretch;
- waveform UI;
- analysis;
- library.

## Clock law
Deck A runs inside an AudioWorklet attached to the proven shared AudioContext.

Authoritative transport state:
`sourceFrame` in decoded PCM frames.

The main/UI thread may request transport changes but never increments position.

## Decode law
Decoder is a provider contract.

Initial provider:
`web-audio.decodeAudioData`.

Decoded PCM is resampled by Web Audio to the engine AudioContext sample rate before Deck A owns it.

Phase 3 fails closed on decoded channel counts other than mono or stereo.

## Playback-rate law
Phase 3 implements deterministic varispeed only:
`sourceFrame += playbackRate` per rendered output frame.

No claim of key-lock/time-stretch is allowed.

## Volume law
Volume range: 0..1.
Volume automation executes as an AudioWorklet AudioParam on the audio timeline.
Mute is independent state that forces effective output gain to zero.

## Status
Deck A exposes:
- output current frame;
- output sample rate;
- render quantum;
- worklet process count;
- worklet frame discontinuities;
- decoder provider;
- loaded state;
- source frame/count/channels/rate/duration;
- playing/ended/muted;
- effective volume/rate;
- current output peak;
- AudioContext state and latency values.

## Gates

### T1 unit
- seek clamping;
- fractional interpolation;
- arbitrary-block transport partition invariance;
- long deterministic rate simulation.

### T3 integration/build
- audio-kernel regression suite remains green;
- typecheck;
- unit tests;
- production build.

### T4 browser runtime
Using a generated WAV through the real decode provider:
- decoded PCM loads;
- play advances source frame;
- pause freezes source frame;
- seek is frame-addressable;
- 1.5x varispeed measures approximately 1.5 source frames per output frame;
- analyser confirms volume reduction;
- mute reaches effectively silent output;
- 600 ms main-thread stall produces no new Deck A worklet discontinuities;
- end-of-track clamps and stops cleanly.

### T5 local physical
Only after T1-T4 pass:
- exact SHA on local Windows browser/audio device;
- generated WAV and at least one ordinary local audio track if available;
- audible play/pause/seek/rate/volume/mute;
- 10-cycle transport stress;
- 5-minute continuous playback;
- UI/main-thread stress while audio continues;
- exact environment/latency/discontinuity report through debug bus.

Deck A cannot be PROVEN/LOCKED before T5.
