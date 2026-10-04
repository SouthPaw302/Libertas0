import type { DeckController, DeckStatus } from '../deck/DeckController';
import type { BeatGrid } from '../music/MusicalClock';
import { createSyncSharedBuffer } from './SharedSyncBus';
import {
  DEFAULT_SYNC_OPTIONS,
  type SyncControlOptions,
} from './SyncMath';

export type DeckId = 'A' | 'B';

export interface SyncSessionStatus {
  enabled: boolean;
  leader: DeckId | null;
  follower: DeckId | null;
  leaderDeck: DeckStatus | null;
  followerDeck: DeckStatus | null;
}

export class SyncController {
  private buffer: SharedArrayBuffer | null = null;
  private leaderId: DeckId | null = null;
  private followerId: DeckId | null = null;

  constructor(
    private readonly deckA: DeckController,
    private readonly deckB: DeckController,
  ) {}

  async enable(
    leaderId: DeckId,
    leaderGrid: BeatGrid,
    followerGrid: BeatGrid,
    options: SyncControlOptions = DEFAULT_SYNC_OPTIONS,
  ): Promise<SyncSessionStatus> {
    const followerId: DeckId = leaderId === 'A' ? 'B' : 'A';
    const leader = this.deck(leaderId);
    const follower = this.deck(followerId);

    const [leaderStatus, followerStatus] = await Promise.all([
      leader.requestStatus(),
      follower.requestStatus(),
    ]);

    if (!leaderStatus.loaded || !followerStatus.loaded) {
      throw new Error('SYNC requires both decks to have loaded PCM');
    }
    if (leaderStatus.sourceSampleRate <= 0 || followerStatus.sourceSampleRate <= 0) {
      throw new Error('SYNC requires valid decoded sample rates');
    }

    await this.disable();

    const buffer = createSyncSharedBuffer();
    await leader.configureSyncPublisher(buffer, leaderGrid);
    await follower.configureSyncFollower(
      buffer,
      leaderGrid,
      followerGrid,
      options,
    );

    this.buffer = buffer;
    this.leaderId = leaderId;
    this.followerId = followerId;
    return this.status();
  }

  async disable(): Promise<void> {
    await Promise.allSettled([
      this.deckA.disableSync(),
      this.deckB.disableSync(),
    ]);
    this.buffer = null;
    this.leaderId = null;
    this.followerId = null;
  }

  async status(): Promise<SyncSessionStatus> {
    if (!this.leaderId || !this.followerId) {
      return {
        enabled: false,
        leader: null,
        follower: null,
        leaderDeck: null,
        followerDeck: null,
      };
    }

    const [leaderDeck, followerDeck] = await Promise.all([
      this.deck(this.leaderId).requestStatus(),
      this.deck(this.followerId).requestStatus(),
    ]);

    return {
      enabled: true,
      leader: this.leaderId,
      follower: this.followerId,
      leaderDeck,
      followerDeck,
    };
  }

  private deck(id: DeckId): DeckController {
    return id === 'A' ? this.deckA : this.deckB;
  }
}
