import { beatPositionToSourceFrame, sourceFrameToBeatPosition, validateBeatGrid, type BeatGrid } from '../music/MusicalClock';
import type { AutomationPoint } from '../automation/AutomationTypes';

export type MixDeck = 'A' | 'B';

export interface TransitionDeck {
  deck: MixDeck;
  sourceId: string;
  sourceFrame: number;
  sourceFrames: number;
  sourceSampleRate: number;
  playbackRate: number;
  loaded: boolean;
  playing: boolean;
  grid: BeatGrid | null;
  gridTrusted: boolean;
}

export interface TransitionRequest {
  outgoing: TransitionDeck;
  incoming: TransitionDeck;
  bars: number;
  phraseBars?: number;
  minLeadBeats?: number;
  maxBpmDifference?: number;
}

export interface TransitionPlan {
  id: string;
  outgoing: MixDeck;
  incoming: MixDeck;
  outgoingSourceId: string;
  incomingSourceId: string;
  outgoingFrames: number;
  incomingFrames: number;
  outgoingSampleRate: number;
  incomingSampleRate: number;
  outgoingGrid: BeatGrid;
  incomingGrid: BeatGrid;
  targetBeat: number;
  entryCueFrame: number;
  durationBeats: number;
  durationSeconds: number;
  targetDelaySeconds: number;
  crossfader: AutomationPoint[];
  tempoDifference: number;
  note: string;
}

export type TransitionDecision =
  | { ok: true; plan: TransitionPlan }
  | { ok: false; reason: string };

const refuse = (reason: string): TransitionDecision => ({ ok: false, reason });
const finite = (n: number): boolean => Number.isFinite(n);

function validDeck(deck: TransitionDeck): boolean {
  return deck.loaded && deck.playing && Boolean(deck.sourceId) &&
    finite(deck.sourceFrame) && deck.sourceFrame >= 0 &&
    finite(deck.sourceFrames) && deck.sourceFrames > 0 &&
    finite(deck.sourceSampleRate) && deck.sourceSampleRate > 0 &&
    finite(deck.playbackRate) && deck.playbackRate > 0 &&
    deck.sourceFrame < deck.sourceFrames;
}

export function planTransition(request: TransitionRequest): TransitionDecision {
  const { outgoing, incoming } = request;
  if (outgoing.deck === incoming.deck) return refuse('SAME_DECK');
  if (!validDeck(outgoing) || !validDeck(incoming)) return refuse('DECK_NOT_READY');
  if (!outgoing.grid || !incoming.grid || !outgoing.gridTrusted || !incoming.gridTrusted) {
    return refuse('GRID_NOT_TRUSTED');
  }
  if (!Number.isInteger(request.bars) || request.bars < 1 || request.bars > 32) {
    return refuse('INVALID_TRANSITION_BARS');
  }
  const phraseBars = request.phraseBars ?? 4;
  const leadBeats = request.minLeadBeats ?? 4;
  const maxDifference = request.maxBpmDifference ?? 0.08;
  if (!Number.isInteger(phraseBars) || phraseBars < 1 || phraseBars > 16 ||
    !finite(leadBeats) || leadBeats < 1 ||
    !finite(maxDifference) || maxDifference < 0 || maxDifference > 0.5) {
    return refuse('INVALID_PLAN_OPTIONS');
  }
  let a: BeatGrid;
  let b: BeatGrid;
  try {
    a = validateBeatGrid(outgoing.grid);
    b = validateBeatGrid(incoming.grid);
  } catch {
    return refuse('INVALID_BEAT_GRID');
  }
  if (a.beatsPerBar !== b.beatsPerBar || a.beatUnit !== b.beatUnit) {
    return refuse('METER_MISMATCH');
  }
  const tempoDifference = Math.abs(a.bpm - b.bpm) / a.bpm;
  if (tempoDifference > maxDifference) return refuse('TEMPO_INCOMPATIBLE');
  const currentBeat = sourceFrameToBeatPosition(outgoing.sourceFrame, outgoing.sourceSampleRate, a);
  const phraseBeats = phraseBars * a.beatsPerBar;
  const targetBeat = Math.ceil((currentBeat + leadBeats) / phraseBeats) * phraseBeats;
  const durationBeats = request.bars * a.beatsPerBar;
  const effectiveBpm = a.bpm * outgoing.playbackRate;
  const durationSeconds = 60 * durationBeats / effectiveBpm;
  const targetDelaySeconds = 60 * (targetBeat - currentBeat) / effectiveBpm;
  const endFrame = beatPositionToSourceFrame(targetBeat + durationBeats, outgoing.sourceSampleRate, a);
  if (endFrame >= outgoing.sourceFrames) return refuse('OUTGOING_END_TOO_NEAR');
  if (incoming.sourceFrame + (targetDelaySeconds + durationSeconds) *
    incoming.sourceSampleRate * incoming.playbackRate >= incoming.sourceFrames) {
    return refuse('INCOMING_END_TOO_NEAR');
  }
  const points: AutomationPoint[] = [
    { offsetSeconds: 0, value: outgoing.deck === 'A' ? -1 : 1 },
    { offsetSeconds: durationSeconds / 4, value: outgoing.deck === 'A' ? -0.5 : 0.5 },
    { offsetSeconds: durationSeconds / 2, value: 0 },
    { offsetSeconds: durationSeconds * 3 / 4, value: outgoing.deck === 'A' ? 0.5 : -0.5 },
    { offsetSeconds: durationSeconds, value: outgoing.deck === 'A' ? 1 : -1 },
  ];
  const incomingNowBeat = sourceFrameToBeatPosition(incoming.sourceFrame, incoming.sourceSampleRate, b);
  const entryCueFrame = beatPositionToSourceFrame(
    Math.max(0, Math.ceil(incomingNowBeat / b.beatsPerBar) * b.beatsPerBar),
    incoming.sourceSampleRate, b);
  return {
    ok: true,
    plan: {
      id: [outgoing.sourceId, incoming.sourceId, targetBeat, durationBeats].join(':'),
      outgoing: outgoing.deck, incoming: incoming.deck,
      outgoingSourceId: outgoing.sourceId, incomingSourceId: incoming.sourceId,
      outgoingFrames: outgoing.sourceFrames, incomingFrames: incoming.sourceFrames,
      outgoingSampleRate: outgoing.sourceSampleRate, incomingSampleRate: incoming.sourceSampleRate,
      outgoingGrid: a, incomingGrid: b,
      targetBeat, entryCueFrame, durationBeats, durationSeconds, targetDelaySeconds,
      crossfader: points, tempoDifference,
      note: 'Assisted mix only. Both decks must already be playing and SYNC-locked; no hidden seeks.',
    },
  };
}
