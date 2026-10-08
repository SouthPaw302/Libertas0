import { describe, expect, it } from 'vitest';
import { planTransition, type TransitionDeck, type TransitionRequest } from './TransitionPlanner';

const sample = (deck: 'A' | 'B', bpm = 120): TransitionDeck => ({
  deck, sourceId: deck + '-take-1', loaded: true, playing: true,
  sourceFrame: 48_000, sourceFrames: 48_000 * 120, sourceSampleRate: 48_000,
  playbackRate: 1, gridTrusted: true,
  grid: { bpm, firstBeatFrame: 0, beatsPerBar: 4, beatUnit: 4 },
});
const request = (a = sample('A'), b = sample('B')): TransitionRequest => ({
  outgoing: a, incoming: b, bars: 4,
});

describe('Module 18 deterministic transition planner', () => {
  it('aligns to the next phrase and has stable identical output', () => {
    const first = planTransition(request());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.plan.targetBeat).toBe(16);
    expect(first.plan.durationBeats).toBe(16);
    expect(first.plan.durationSeconds).toBe(8);
    expect(first.plan.crossfader.map(point => point.value)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(planTransition(request())).toEqual(first);
  });
  it('reverses crossfader for deck B outgoing', () => {
    const result = planTransition({ outgoing: sample('B'), incoming: sample('A'), bars: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.crossfader.map(point => point.value)).toEqual([1, 0.5, 0, -0.5, -1]);
  });
  it('refuses incompatible tempo', () => {
    expect(planTransition(request(sample('A', 120), sample('B', 145)))).toEqual({ ok: false, reason: 'TEMPO_INCOMPATIBLE' });
  });
  it('refuses untrusted grid rather than guessing', () => {
    expect(planTransition(request({ ...sample('A'), gridTrusted: false }))).toEqual({ ok: false, reason: 'GRID_NOT_TRUSTED' });
  });
  it('refuses bad meter and missing deck playback', () => {
    const b = sample('B');
    expect(planTransition(request(sample('A'), { ...b, grid: { ...b.grid!, beatsPerBar: 3 } }))).toEqual({ ok: false, reason: 'METER_MISMATCH' });
    expect(planTransition(request({ ...sample('A'), playing: false }))).toEqual({ ok: false, reason: 'DECK_NOT_READY' });
  });
  it('refuses tracks too short for the proposed fade', () => {
    expect(planTransition(request({ ...sample('A'), sourceFrames: 48_000 * 5 }))).toEqual({ ok: false, reason: 'OUTGOING_END_TOO_NEAR' });
    expect(planTransition(request(sample('A'), { ...sample('B'), sourceFrames: 48_000 * 5 }))).toEqual({ ok: false, reason: 'INCOMING_END_TOO_NEAR' });
  });
  it('rejects invalid phase requirements instead of using timers', () => {
    expect(planTransition({ ...request(), phraseBars: 0 })).toEqual({ ok: false, reason: 'INVALID_PLAN_OPTIONS' });
    expect(planTransition({ ...request(), bars: 0 })).toEqual({ ok: false, reason: 'INVALID_TRANSITION_BARS' });
  });
});
