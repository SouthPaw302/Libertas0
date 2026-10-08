import type { DeckController, DeckStatus } from '../deck/DeckController';
import type { MixerController } from '../mixer/MixerController';
import type { SyncController } from '../sync/SyncController';
import type { BeatGrid } from '../music/MusicalClock';
import { sourceFrameToBeatPosition } from '../music/MusicalClock';
import { planTransition, type MixDeck, type TransitionDecision, type TransitionPlan } from './TransitionPlanner';

export type AutoMixState = 'IDLE' | 'PLANNED' | 'ARMED' | 'EXECUTING' | 'COMPLETED' | 'ABORTED' | 'REFUSED';

export interface AutoMixStatus {
  state: AutoMixState;
  plan: TransitionPlan | null;
  startContextTime: number | null;
  endContextTime: number | null;
  reason: string | null;
}

export class AutoMixController {
  private state: AutoMixState = 'IDLE';
  private selected: TransitionPlan | null = null;
  private reason: string | null = null;
  private startAt: number | null = null;
  private endAt: number | null = null;
  private generation = 0;
  private readonly identities = new Map<MixDeck, string>();
  private readonly trusted = new Set<MixDeck>();

  constructor(private readonly deps: {
    context: AudioContext;
    deckA: DeckController;
    deckB: DeckController;
    mixer: MixerController;
    sync: SyncController;
    getGrid: (deck: MixDeck) => BeatGrid;
  }) {}

  recordLoad(deck: MixDeck, description: string): void {
    this.generation += 1;
    this.identities.set(deck, deck + ':' + this.generation + ':' + description);
    this.trusted.delete(deck);
    if (this.state === 'PLANNED' || this.state === 'ARMED' || this.state === 'EXECUTING') {
      this.cancel('TRACK_REPLACED');
    }
  }

  trustGrid(deck: MixDeck): void {
    this.trusted.add(deck);
    if (this.state === 'PLANNED' || this.state === 'ARMED' || this.state === 'EXECUTING') {
      this.cancel('GRID_CHANGED');
    }
  }

  async plan(outgoing: MixDeck, bars = 4, phraseBars = 4): Promise<TransitionDecision> {
    if (this.state === 'ARMED' || this.state === 'EXECUTING') {
      return { ok: false, reason: 'ALREADY_ARMED' };
    }
    const incoming: MixDeck = outgoing === 'A' ? 'B' : 'A';
    let from: DeckStatus;
    let to: DeckStatus;
    try {
      [from, to] = await Promise.all([
        this.deck(outgoing).requestStatus(), this.deck(incoming).requestStatus(),
      ]);
    } catch {
      this.selected = null;
      this.reason = 'DECK_NOT_READY';
      this.state = 'REFUSED';
      return { ok: false, reason: 'DECK_NOT_READY' };
    }
    const toInput = (deck: MixDeck, status: DeckStatus) => ({
      deck, sourceId: this.identities.get(deck) ?? '',
      loaded: status.loaded, playing: status.playing,
      sourceFrame: status.sourceFrame, sourceFrames: status.sourceFrames,
      sourceSampleRate: status.sourceSampleRate, playbackRate: status.playbackRate,
      grid: this.deps.getGrid(deck), gridTrusted: this.trusted.has(deck),
    });
    const decision = planTransition({
      outgoing: toInput(outgoing, from), incoming: toInput(incoming, to),
      bars, phraseBars,
    });
    this.selected = decision.ok ? decision.plan : null;
    this.reason = decision.ok ? null : decision.reason;
    this.state = decision.ok ? 'PLANNED' : 'REFUSED';
    this.startAt = null;
    this.endAt = null;
    return decision;
  }

  async arm(): Promise<AutoMixStatus> {
    const plan = this.selected;
    if (!plan || this.state !== 'PLANNED') throw new Error('AUTOMIX_NO_PLAN');
    const [from, to, sync, mixer] = await Promise.all([
      this.deck(plan.outgoing).requestStatus(), this.deck(plan.incoming).requestStatus(),
      this.deps.sync.status(), this.deps.mixer.requestStatus(),
    ]);
    const sameSources =
      this.identities.get(plan.outgoing) === plan.outgoingSourceId &&
      this.identities.get(plan.incoming) === plan.incomingSourceId &&
      from.sourceFrames === plan.outgoingFrames &&
      to.sourceFrames === plan.incomingFrames &&
      from.sourceSampleRate === plan.outgoingSampleRate &&
      to.sourceSampleRate === plan.incomingSampleRate;
    if (!sameSources || !this.trusted.has(plan.outgoing) || !this.trusted.has(plan.incoming)) {
      return this.refuse('STALE_PLAN');
    }
    if (!from.loaded || !to.loaded || !from.playing || !to.playing || from.loopEnabled || to.loopEnabled) {
      return this.refuse('DECK_NOT_READY_OR_LOOPING');
    }
    if (!sync.enabled || sync.leader !== plan.outgoing || sync.follower !== plan.incoming ||
      !sync.followerDeck?.syncTracking || !sync.followerDeck.syncLocked) {
      return this.refuse('SYNC_NOT_LOCKED');
    }
    const outgoingPosition = plan.outgoing === 'A' ? -1 : 1;
    if (Math.abs(mixer.crossfader - outgoingPosition) > 0.08) {
      return this.refuse('CROSSFADER_NOT_STAGED');
    }
    const currentGrid = this.deps.getGrid(plan.outgoing);
    if (JSON.stringify(currentGrid) !== JSON.stringify(plan.outgoingGrid) ||
      JSON.stringify(this.deps.getGrid(plan.incoming)) !== JSON.stringify(plan.incomingGrid)) {
      return this.refuse('GRID_CHANGED');
    }
    const beat = sourceFrameToBeatPosition(from.sourceFrame, from.sourceSampleRate, currentGrid);
    const beatDelta = plan.targetBeat - beat;
    const secondsUntilTarget = beatDelta * 60 / (currentGrid.bpm * from.playbackRate);
    // The deck reports the AudioWorklet's outputCurrentFrame; the controller only
    // translates an existing clock position into AudioContext automation time.
    const startContextTime = from.outputCurrentFrame / from.sampleRate + secondsUntilTarget;
    if (!Number.isFinite(startContextTime) || startContextTime < this.deps.context.currentTime + 0.15) {
      return this.refuse('PLAN_EXPIRED');
    }
    this.deps.mixer.scheduleCrossfader(plan.crossfader, startContextTime);
    this.startAt = startContextTime;
    this.endAt = startContextTime + plan.durationSeconds;
    this.state = 'ARMED';
    this.reason = null;
    return this.status();
  }

  status(): AutoMixStatus {
    const now = this.deps.context.currentTime;
    if (this.state === 'ARMED' && this.startAt !== null && now >= this.startAt) this.state = 'EXECUTING';
    if (this.state === 'EXECUTING' && this.endAt !== null && now >= this.endAt) this.state = 'COMPLETED';
    return {
      state: this.state, plan: this.selected,
      startContextTime: this.startAt, endContextTime: this.endAt,
      reason: this.reason,
    };
  }

  cancel(reason = 'USER_CANCELLED'): AutoMixStatus {
    const s = this.status();
    if (s.state === 'ARMED' || s.state === 'EXECUTING') {
      const now = this.deps.context.currentTime;
      const held = this.crossfaderAt(now);
      this.deps.mixer.cancelAutomation('crossfader', now);
      this.deps.mixer.setCrossfader(held);
    }
    this.state = 'ABORTED';
    this.reason = reason;
    return this.status();
  }

  manualOverride(value: number): AutoMixStatus {
    if (this.state === 'PLANNED' || this.state === 'ARMED' || this.state === 'EXECUTING') this.cancel('MANUAL_OVERRIDE');
    this.deps.mixer.setCrossfader(value);
    return this.status();
  }

  private crossfaderAt(now: number): number {
    if (!this.selected || this.startAt === null) return 0;
    const points = this.selected.crossfader;
    const t = now - this.startAt;
    if (t <= 0) return points[0]!.value;
    for (let i = 1; i < points.length; i += 1) {
      const before = points[i - 1]!;
      const after = points[i]!;
      if (t <= after.offsetSeconds) {
        const u = (t - before.offsetSeconds) / (after.offsetSeconds - before.offsetSeconds);
        return before.value + (after.value - before.value) * u;
      }
    }
    return points[points.length - 1]!.value;
  }

  private refuse(reason: string): AutoMixStatus {
    this.reason = reason;
    this.state = 'REFUSED';
    return this.status();
  }

  private deck(deck: MixDeck): DeckController {
    return deck === 'A' ? this.deps.deckA : this.deps.deckB;
  }
}
