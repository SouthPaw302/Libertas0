# Track Intelligence Contract v1

## Scope
Phase 9 introduces non-realtime track analysis that proposes musical metadata for the proven Musical Clock and SYNC systems.

Reference output:
- BPM candidate;
- tempo confidence;
- first-beat / beat-grid anchor candidate in source frames;
- phase confidence;
- combined grid confidence;
- RMS, peak, crest factor, and zero-crossing descriptors;
- provenance/provider identifier.

Phase 9 does not claim:
- semantic bar downbeat detection;
- phrase detection;
- musical key detection;
- variable-tempo warp maps;
- AI/ML model inference;
- automatic mutation of the active grid.

## Authority law
Track Intelligence is advisory only.

It runs outside the realtime audio render path in a Web Worker. It may propose a grid. It may never:
- advance transport;
- own musical time;
- change deck rate;
- engage SYNC;
- silently replace the current manual grid.

The grid changes only through an explicit Apply action.

## Reference analyzer
The reference provider is `libertas.onset-autocorrelation.v1`.

Pipeline:
1. decode encoded audio with the existing replaceable PCM decoder;
2. mix PCM to mono;
3. transfer mono PCM to a Web Worker;
4. compute a ~400 Hz RMS energy envelope;
5. half-wave rectify positive log-energy changes into an onset-strength envelope;
6. search BPM in the configured DJ range with normalized autocorrelation plus octave-bias correction;
7. refine the winning lag;
8. estimate beat phase from the first 16 beat periods;
9. locate the earliest strong onset aligned to that phase;
10. return confidence and descriptors.

Default tempo search range: 70–180 BPM.

## Confidence
Tempo and phase confidence are reported separately.
Overall grid confidence is the geometric mean of the two.
The reference UI marks a proposal recommended only at grid confidence >= 0.45.

Low-confidence results remain visible but must not be silently applied.

## Grid semantics
The analyzer proposes:
- `bpm`;
- `firstBeatFrame`;
- `beatsPerBar=4`;
- `beatUnit=4`.

`firstBeatFrame` is a beat-phase anchor candidate, not a proven semantic bar downbeat.
Users may edit/replace it with the existing manual grid tools.

## Gates
### T1
- tempo estimation across representative 70–180 BPM fixtures;
- octave-error resistance;
- beat-anchor recovery;
- short-track rejection.

### T3/T4 browser
- analysis executes in Web Worker;
- 128 BPM + offset fixture recovers BPM and anchor with confidence;
- analysis alone leaves active grid unchanged;
- explicit Apply updates the grid;
- two independently analyzed unknown-grid fixtures can feed the existing SYNC engine and lock without manual BPM entry;
- all locked Phase 2–8 regressions remain green.

### Real-track validation
Generated fixtures prove algorithm mechanics, not universal real-music accuracy. Ordinary-track BPM/grid accuracy must be separately measured before removing the existing ordinary-track SYNC limitation.
