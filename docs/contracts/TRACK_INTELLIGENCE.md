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
The reference provider is `libertas.rhythm-ensemble.v2`.

Pipeline:
1. decode encoded audio with the existing replaceable PCM decoder;
2. mix PCM to mono;
3. transfer mono PCM to a Web Worker;
4. retain the v1 log-energy onset/autocorrelation estimate as an independent diagnostic;
5. compute a spectral-flux onset detection function with a 2048-frame STFT and 512-frame hop;
6. rank 70–180 BPM candidates with comb-filter resonance across beat-period harmonics using `@audio/beat` 3.0.0;
7. retain the top five non-duplicate tempo candidates in diagnostics;
8. derive absolute tempo confidence from spectral autocorrelation plus winner/runner-up separation rather than trusting the comb's normalized winner alone;
9. estimate beat phase against the spectral onset function;
10. return confidence, descriptors, candidate provenance and the proposal.

The v1 estimate never overrides the v2 spectral-comb result. It remains visible so ordinary-track failures can show whether the two estimators agree or diverge.

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


## Ordinary-track failure rule
A deterministic result is not automatically a valid result. If ordinary material returns a low-confidence or implausible proposal, the proposal remains non-recommended and must not be applied merely to continue the test. Phase 9 keeps the local gate closed until the analyzer itself produces a defensible grid.
