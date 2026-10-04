# Track Intelligence Contract v1

## Scope
Phase 9 adds background analysis that may propose musical metadata for a decoded track.

Reference outputs:
- BPM candidate;
- BPM confidence;
- beat-anchor source-frame candidate;
- beat-anchor confidence;
- overall confidence;
- explicit Musical Clock grid proposal;
- RMS;
- peak;
- crest factor;
- zero-crossing rate;
- approximate spectral centroid;
- complete provider/provenance metadata.

Phase 9 does not add:
- automatic grid mutation;
- realtime clock authority;
- hidden BPM correction;
- downbeat/bar classification;
- key detection;
- phrase/structure segmentation;
- stems;
- neural inference;
- cloud analysis.

## Authority law
Track Intelligence is advisory.

It may propose a grid. It may never silently alter:
- deck sourceFrame;
- playback rate;
- Musical Clock grid;
- SYNC state;
- performance transport;
- mixer/DSP.

Only an explicit Apply Proposal action may copy the proposal into the Musical Clock grid.

## Execution domain
Encoded audio is decoded asynchronously with Web Audio `decodeAudioData()`.
Decoded channels are averaged into mono PCM.
Analysis PCM is transferred to a dedicated Web Worker.
The worker contains no AudioContext, AudioWorklet, UI, transport or SYNC authority.

## Reference algorithm
Provider:
`libertas.reference-onset-autocorrelation.v1`

1. Build a ~200 Hz onset envelope from positive RMS flux plus positive sample-derivative flux.
2. Search 70–190 BPM with normalized autocorrelation.
3. Refine the best autocorrelation lag using three-point parabolic interpolation.
4. Find the periodic onset phase for that tempo.
5. Select the earliest sufficiently strong onset aligned to that phase as the beat-anchor candidate.
6. Return confidence values and a proposal. Do not claim downbeat classification.

The default BPM range is deliberately DJ-oriented. Future providers may expose other ranges.

## Grid semantics
The proposed grid is:
- BPM = estimated tempo;
- firstBeatFrame = estimated beat anchor;
- beatsPerBar = 4;
- beatUnit = 4;
- status = proposal.

The 4/4 meter value is a proposal default, not a meter classifier.

## Confidence
Confidence is evidence, not permission.
Low confidence must remain visible.
The reference provider fails closed on insufficient transient structure instead of inventing a BPM.

## Gates

### T1 unit
- 120 BPM synthetic click recovery;
- 128 BPM recovery at 44.1 kHz;
- delayed beat-anchor recovery;
- descriptors finite and plausible;
- silence fails closed.

### T4 browser runtime
- Worker path recovers generated BPM/anchor;
- analysis leaves manual grid unchanged until explicit Apply;
- explicit Apply copies proposal into Musical Clock;
- analysis while Deck A is playing adds zero audio-worklet discontinuities;
- accepted generated proposals can feed the proven SYNC controller;
- every locked Phase 2–8 browser regression remains green.

No new T5 physical gate is required for Phase 9 reference infrastructure because analysis is advisory and introduces no new audible execution path. Ordinary-track accuracy remains an evidence task and must not be inferred from synthetic fixtures.
