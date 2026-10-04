# SYNC Contract v1

## Scope
Phase 6 adds deterministic two-deck tempo and beat-phase synchronization using the proven deck source-frame clocks and manual musical grids.

It provides:
- selectable leader A or B;
- follower tempo matching from BPM ratio;
- beat-phase error measured in musical coordinates;
- bounded phase-rate correction;
- smoothed effective follower rate;
- realtime shared-state exchange between deck AudioWorklets;
- lock/tracking diagnostics;
- no corrective transport seeks after SYNC is engaged.

It does not yet provide:
- BPM/downbeat detection;
- key lock / tempo-preserving stretch;
- loops;
- cue launch;
- scratch;
- phrase/bar matching;
- automatic master election.

## Authority law
SYNC is a controller, not a clock.

The AudioWorklet render timeline remains realtime authority.
Each deck sourceFrame remains transport truth.
The Musical Clock remains the sourceFrame -> beat coordinate transform.
SYNC may change only the follower's effective playback rate.

## Realtime transport
The two deck AudioWorklets exchange leader state through a SharedArrayBuffer guarded by an atomic sequence lock.

The leader publishes:
- output render frame;
- source frame;
- effective playback rate;
- decoded source sample rate;
- BPM;
- first-beat source-frame anchor;
- playing state.

The follower projects the leader source position to its own current render frame before computing phase.

SYNC must keep operating while the browser main thread is blocked.

## Tempo matching
Follower nominal rate:

```text
leaderEffectiveRate * leaderBpm / followerBpm
```

This is varispeed. Phase 6 makes no key-lock claim.

## Phase lock
Beat phase error is wrapped to the nearest beat in [-0.5, 0.5).

Follower correction:

```text
phaseErrorBeats * 60 / (followerBpm * phaseSettleSeconds)
```

Correction is bounded and added to the tempo-matched rate.

Default control values:
- settle: 1.25 s
- maximum transient correction: +/-0.08 rate
- deadband: 0.001 beat
- rate smoothing: 0.04 s
- lock threshold: 0.01 beat
- stale shared-state threshold: 0.10 s

The final requested rate is clamped to the proven deck domain [0.25, 4].

## No-seek law
After SYNC is engaged, phase correction may not call deck seek.

A test must baseline transportSeekCount before engagement and prove it does not increase during convergence.

## Failure behavior
If the shared leader snapshot is missing or stale:
- do not seek;
- mark tracking/lock false;
- continue from the last smoothed rate until valid leader state resumes.

## Gates

### T1 unit
- wrapped phase error;
- BPM-ratio tempo rate;
- correction bounds/deadband;
- supported rate clamp;
- smooth rate transition;
- long convergence simulation;
- SharedArrayBuffer seqlock round trip.

### T2 simulation
A follower starting >=0.30 beat out of phase at a different BPM must converge below 0.003 beat in the deterministic simulation without transport seeks.

### T3 integration
All locked audio-kernel, Deck A, Deck B/mixer and Musical Clock regressions remain green.

### T4 browser runtime
With generated click tracks and manual grids:
- A leader / B follower converges from a >=0.30 beat offset;
- follower tempo approaches BPM ratio;
- transportSeekCount does not increase after engagement;
- a leader manual rate change is followed;
- 600 ms main-thread block does not break tracking or add worklet discontinuities;
- leadership can be reversed and converge.

### T5 local physical + human listening
On the exact T4 SHA:
- use generated click tracks with intentionally different BPM and phase;
- hear the clicks converge and remain together;
- repeat with two ordinary tracks whose manual grids are supplied accurately;
- listen >=5 minutes;
- stress UI/main thread;
- change leader rate;
- reverse leadership;
- record phase error, rates, discontinuities, seek counts and audible defects.

Phase 6 cannot be LOCKED before T5 PASS.
