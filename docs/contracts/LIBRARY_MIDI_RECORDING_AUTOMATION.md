# Library / MIDI / Recording / Automation Contract v1

## Scope
Phase 10 adds operator workflow infrastructure around the locked realtime core:
- local browser track library;
- deterministic MIDI mapping and MIDI-learn;
- master-output recording;
- continuous parameter automation.

It does not move transport, Musical Clock, SYNC or DSP authority out of their locked modules.

## Library
The local reference library uses IndexedDB.

Each imported file:
- is SHA-256 identified from its bytes;
- is deduplicated by content hash;
- persists encoded audio bytes plus basic metadata;
- may later persist analysis metadata under the same identity;
- can be decoded into either existing deck without a new transport implementation.

IndexedDB is an implementation provider, not the canonical project database architecture for future desktop/distributed providers.

## MIDI
The deterministic MIDI mapping engine is browser-independent:
- parses Note On and CC messages;
- supports explicit bindings;
- supports learn-next-message;
- maps normalized CC values into declared target ranges;
- emits actions only.

The Web MIDI adapter is optional because browser support is not universal and access is permissioned. Absence or denial of Web MIDI must not prevent decks, library, recording or automation from running.

No MIDI event is a clock source.

## Recording
The master recorder taps the post-limiter mixer output through a MediaStreamAudioDestinationNode and records that MediaStream with MediaRecorder.

Recording is a side tap. It may not sit in series with physical output or become a render authority.

## Automation
Phase 10 automation controls continuous AudioParams only.

The reference registry includes:
- master volume;
- crossfader;
- Channel A/B trim;
- Channel A/B bipolar filter.

Automation points use offsets relative to AudioContext time and are scheduled ahead with AudioParam timeline methods. Once scheduled, a main-thread stall must not stop the audio-engine parameter trajectory.

Automation does not schedule cue/hotcue/seek/SYNC commands in Phase 10.

## Gates

### T1
- automation lane validation;
- MIDI decode, learn and scaling.

### T3/T4 browser
- IndexedDB content dedupe and deck reload;
- learned synthetic MIDI CC controls the actual crossfader;
- MediaRecorder captures a non-empty post-mixer recording;
- scheduled crossfade completes through a 600 ms main-thread block;
- zero new A/B/mixer discontinuities;
- all locked Phase 2–9 regressions remain green.

### T5 local
- import ordinary audio to library, reload page, verify persistence, load to A/B;
- record >=60 seconds of real mixed playback and replay/export the result;
- exercise automation during physical playback and through a 600 ms UI stall;
- exercise synthetic MIDI mapping on the real browser; if a physical MIDI device is available, additionally verify permission/connect/learn hardware path;
- confirm no new A/B/mixer discontinuities or hidden SYNC seeks.

Hardware MIDI availability is environmental. Phase 10 may prove the deterministic mapping engine and browser adapter capability without claiming a specific physical controller if none is attached.
