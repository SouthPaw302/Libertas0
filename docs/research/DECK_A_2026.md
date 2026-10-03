# Deck A Research — October 2026

## Scope
Phase 3 needs one deterministic browser deck on the proven AudioWorklet clock:
load/decode, PCM ownership, play/pause, seek, source position, rate, volume, mute, and end-of-track.

## Decode choice

### Provider 1 — Web Audio decodeAudioData
`BaseAudioContext.decodeAudioData()` remains broadly available. It decodes complete-file `ArrayBuffer` data asynchronously and returns an `AudioBuffer` resampled to the owning AudioContext sample rate.

This is useful for the reference deck because the decoded PCM domain and output engine domain have one sample rate.

Source:
https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData

### WebCodecs AudioDecoder
`AudioDecoder` is useful and can run in Dedicated Workers, but it remains non-Baseline/limited across major browsers and accepts encoded chunks rather than replacing container demux.

It remains a future decoder provider, not the only Phase 3 path.

Source:
https://developer.mozilla.org/en-US/docs/Web/API/AudioDecoder

## PCM ownership
Deck A v1 transfers decoded mono/stereo Float32 PCM into the AudioWorklet. The realtime deck owns playback position and interpolation after load.

This deliberately avoids:
- HTMLMediaElement transport authority;
- main-thread PCM scheduling;
- a second playback clock;
- WebCodecs/demux complexity before the transport is proven.

The provider contract is replaceable so later work can introduce paged/shared-memory/native decode without changing deck transport semantics.

## Rate
Phase 3 playback rate is varispeed: source position advances by `playbackRate` per output frame. Tempo-preserving time stretch is a later dedicated DSP module.

## Volume
Volume is an AudioWorklet `AudioParam` with a-rate automation. UI changes request automation on the AudioContext timeline rather than multiplying samples on the main thread.

## Test strategy
1. Pure source-frame math.
2. Synthetic WAV -> actual browser decode provider -> transferred PCM.
3. AudioWorklet transport and analyser-measured output.
4. Main-thread stall while source-frame transport continues.
5. Local physical test with generated signal and an ordinary user audio file.
