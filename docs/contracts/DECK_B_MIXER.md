# Deck B + Mixer Contract v1

## Scope
Phase 4 adds:
- Deck B with the same deterministic transport semantics already proven for Deck A;
- independent Deck A and Deck B volume/mute/rate/transport state;
- simultaneous playback;
- a dedicated realtime two-input mixer;
- master volume;
- peak/overload telemetry and fail-safe output clamp.

SYNC is explicitly not part of Phase 4.

## Shared deck implementation law
Deck A and Deck B are instances of one `DeckController` transport implementation.

Deck A's previously proven public behavior remains the regression contract. Deck B may not fork a second transport algorithm.

Each deck independently owns:
- decoded PCM;
- sourceFrame;
- play/pause/seek;
- varispeed;
- volume/mute;
- end state;
- transport diagnostics.

A command on one deck may not alter the other deck's transport state.

## Mixer law
The mixer is an AudioWorklet with two explicit stereo inputs and one stereo output.

Signal path:
`Deck A worklet -> Deck A analyser -> Mixer input 0`
`Deck B worklet -> Deck B analyser -> Mixer input 1`
`Mixer -> master analyser -> physical output`

The mixer:
- sums the two deck signals;
- applies master volume on the audio timeline;
- measures each input peak;
- measures pre-clamp summed peak;
- counts samples that exceed full scale;
- clamps unsafe output into [-1, 1] as a safety boundary;
- exposes output peak and realtime continuity telemetry.

The clamp is not advertised as mastering, compression, or a final limiter. Higher-quality DSP belongs to a later mixer/DSP phase.

## Clock law
Both deck worklets and the mixer execute on the same AudioContext render timeline.

No main-thread timer owns transport or summing.

## Gates

### T1/T3
- Deck A unit/regression tests remain green.
- shared deck controller typechecks/builds.
- existing audio-kernel tests remain green.

### T4 browser runtime
- both decks load independent generated PCM;
- both play simultaneously;
- pausing/seeking A does not alter B and vice versa;
- Deck A/B volume controls are independent;
- master volume acts after summing;
- both deck source-frame clocks and mixer output clock advance during a 600 ms main-thread stall;
- no new worklet discontinuities occur during the stress interval;
- mixer detects overload with two hot in-phase sources;
- unsafe summed output is clamped to full scale;
- Deck A and audio-kernel regression suites remain green.

### T5 local physical
After T1-T4:
- two ordinary local audio files when available;
- simultaneous physical playback;
- independent Deck A/B volume and mute;
- independent play/pause/seek/rate;
- master volume;
- mixed-control stress;
- 600 ms main-thread stall;
- at least 5 minutes simultaneous playback;
- audible confirmation and exact diagnostics through the debug bus.

Phase 4 cannot be locked until T5 passes.
