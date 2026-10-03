# Musical Clock Contract v1

## Scope
Phase 5 introduces deterministic musical coordinates over each deck's already-proven source-frame timeline.

It provides:
- manual BPM;
- first-beat source-frame anchor;
- beats per bar;
- beat unit;
- source frame -> fractional beat;
- fractional beat -> source frame;
- beat index;
- beat within bar;
- bar index;
- beat phase;
- bar phase;
- deterministic beat/sub-beat quantization.

It does not:
- detect BPM;
- detect downbeats;
- alter deck transport;
- perform SYNC;
- time-stretch audio;
- schedule play/cue/loop operations.

## Authority law
The musical clock is not another realtime clock.

Deck `sourceFrame` remains transport truth.
The musical clock is a deterministic coordinate transform over that source-frame domain.

The AudioWorklet render timeline remains the underlying realtime execution authority.

## Grid
Each deck owns an independent grid:

```text
bpm
firstBeatFrame
beatsPerBar
beatUnit
```

`firstBeatFrame` is the source frame assigned to fractional beat position 0.

Frames per beat:

```text
sampleRate * 60 / bpm
```

Beat position:

```text
(sourceFrame - firstBeatFrame) / framesPerBeat
```

Negative beat positions before the first beat are valid.

## Index semantics
- `beatPosition`: continuous signed coordinate.
- `beatIndex`: floor(beatPosition), zero-based relative to firstBeatFrame.
- `beatPhase`: [0,1).
- `beatInBar`: zero-based [0, beatsPerBar).
- `barIndex`: signed zero-based bar containing beatIndex.
- `barPhase`: [0,1) within the bar.

These machine semantics stay zero-based. UI presentation may later render human-friendly 1-based bar/beat labels.

All frame expectations must derive from the deck's actual decoded `sourceSampleRate`; tests and runtime logic must never assume 48 kHz.

## Quantization
Phase 5 computes quantized source-frame targets only.

It supports:
- previous;
- nearest;
- next;
- arbitrary positive quantum size in beats.

Quantization does not move the transport in Phase 5. Scheduling/transport action belongs to later performance/sync modules.

## Gates

### T1 unit
- exact frame↔beat round trip;
- negative pre-roll semantics;
- previous/nearest/next quantization;
- fractional quantum support;
- long-range round-trip error bound;
- independent per-deck grids;
- invalid grids fail closed.

### T2 simulation
Thousands of beat positions across negative pre-roll and long positive timelines must round-trip without cumulative state because mapping is absolute, not iterative.

### T3 integration
- both proven decks load independently;
- separate grids return separate musical positions for identical source frames;
- varispeed changes beat-position velocity only through sourceFrame;
- paused transport freezes musical position;
- quantization does not mutate transport;
- previous audio-kernel/Deck A/Deck B/mixer regressions remain green.

### Runtime integration
During the existing 600 ms main-thread stress, both decks continue to advance and their musical positions remain coherent because mapping derives from returned sourceFrame.

No physical/local gate is required for Phase 5 because it adds no new audio execution path. Physical proof resumes when a later module uses musical coordinates to control audible transport.

Phase 5 may be LOCKED after T1-T3/runtime integration and all locked regressions pass.
