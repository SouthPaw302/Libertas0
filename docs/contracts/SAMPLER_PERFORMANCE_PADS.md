# Sampler / Performance Pads Contract

## Module

Module 15 — `sampler-performance-pads`.

## Goal

Add a compact eight-pad sampler suitable for DJ performance without giving the sampler control of deck transport, Musical Clock phase, or SYNC.

## Pad model

Each of eight pads stores:
- audio bytes;
- display name/type;
- mode: `one-shot` or `loop`;
- gain 0..1;
- quantize amount in beats;
- source clock: Deck A or Deck B.

Pad audio/config is persisted in IndexedDB and restored into runtime AudioBuffers on load.

## Signal path

**pad voices → sampler bus → mixer input 3 → master volume/limiter → Master FX → speakers/recording**

The sampler is not crossfaded with Deck A/B, but it remains under:
- master volume;
- master limiter;
- Master FX;
- final master recording.

## Realtime trigger model

Immediate triggers schedule an `AudioBufferSourceNode` directly on the AudioContext timeline.

Quantized triggers:
1. request authoritative deck status from the selected Deck AudioWorklet;
2. read current `sourceFrame`, `outputCurrentFrame`, sample rate, and rendered playback rate;
3. derive the next requested Musical Clock boundary;
4. map that source-frame boundary onto the AudioContext frame timeline;
5. call `AudioBufferSourceNode.start(scheduledContextTime)`.

Once scheduled, the audio start is owned by Web Audio and survives main-thread/UI stalls.

## Quantization

Supported UI quantization:
- Off;
- 1/4 beat;
- 1/2 beat;
- 1 beat;
- 2 beats;
- 4 beats.

Quantized triggering requires the selected source deck to be playing. Immediate triggering is allowed without a running deck.

## One-shot behavior

One-shot pads may overlap, allowing retrigger/polyphony.

## Loop behavior

A loop pad maintains one active loop voice per pad. Re-trigger replaces the previous loop at the scheduled trigger boundary. Stop is explicit.

## Persistence

The sample bank uses `libertas0-sampler-v1` IndexedDB storage. Reload/restore does not require re-selecting source files.

## Authority boundary

The sampler may read:
- deck source-frame status;
- Musical Clock grids;
- AudioContext time.

The sampler may never:
- write deck `sourceFrame`;
- seek or rate-correct a deck;
- own Musical Clock phase;
- alter SYNC phase/correction;
- trigger deck performance transport;
- use UI timers as musical timing authority.

## Required gates

- unit: source-frame → AudioContext quantized scheduling math;
- integration: eight-pad persistence restore and mixer-input routing;
- runtime: scheduled pad survives a 600 ms main-thread stall with zero new deck/mixer discontinuities;
- loop start/stop;
- locked mixer, recording, transport, SYNC and FX regressions.

## Non-goals

- sample time-stretch/pitch-lock;
- slicer/chop engine;
- velocity-sensitive hardware pads;
- sequencer;
- stem sampling;
- sampler-owned tempo or transport.
