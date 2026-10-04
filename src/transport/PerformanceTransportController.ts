import type { DeckController, DeckStatus } from '../deck/DeckController';
import { beatPositionToSourceFrame, type BeatGrid } from '../music/MusicalClock';

export class PerformanceTransportController {
  constructor(private readonly deck: DeckController) {}

  setCueAtFrame(frame: number): Promise<DeckStatus> {
    return this.deck.setCueFrame(frame);
  }

  setCueHere(): Promise<DeckStatus> {
    return this.deck.setCueHere();
  }

  triggerCue(pause = true): Promise<DeckStatus> {
    return this.deck.triggerCue(pause);
  }

  setHotCue(slot: number, frame: number): Promise<DeckStatus> {
    return this.deck.setHotCue(slot, frame);
  }

  setHotCueHere(slot: number): Promise<DeckStatus> {
    return this.deck.setHotCueHere(slot);
  }

  triggerHotCue(slot: number): Promise<DeckStatus> {
    return this.deck.triggerHotCue(slot);
  }

  clearHotCue(slot: number): Promise<DeckStatus> {
    return this.deck.clearHotCue(slot);
  }

  setLoopFrames(startFrame: number, endFrame: number): Promise<DeckStatus> {
    return this.deck.setLoop(startFrame, endFrame, true);
  }

  async setBeatLoop(
    grid: BeatGrid,
    startBeat: number,
    lengthBeats: number,
  ): Promise<DeckStatus> {
    if (!Number.isFinite(lengthBeats) || lengthBeats <= 0) {
      throw new RangeError('lengthBeats must be positive');
    }
    const status = await this.deck.requestStatus();
    if (!status.loaded || status.sourceSampleRate <= 0) {
      throw new Error('Deck must have loaded PCM before a beat loop can be set');
    }
    const startFrame = beatPositionToSourceFrame(startBeat, status.sourceSampleRate, grid);
    const endFrame = beatPositionToSourceFrame(
      startBeat + lengthBeats,
      status.sourceSampleRate,
      grid,
    );
    return this.deck.setLoop(startFrame, endFrame, true);
  }

  setLoopEnabled(enabled: boolean): Promise<DeckStatus> {
    return this.deck.setLoopEnabled(enabled);
  }

  clearLoop(): Promise<DeckStatus> {
    return this.deck.clearLoop();
  }

  jogByFrames(deltaFrames: number): Promise<DeckStatus> {
    return this.deck.jogByFrames(deltaFrames);
  }

  async jogBySeconds(deltaSeconds: number): Promise<DeckStatus> {
    if (!Number.isFinite(deltaSeconds)) throw new RangeError('deltaSeconds must be finite');
    const status = await this.deck.requestStatus();
    if (!status.loaded || status.sourceSampleRate <= 0) {
      throw new Error('Deck must have loaded PCM before jog');
    }
    return this.deck.jogByFrames(deltaSeconds * status.sourceSampleRate);
  }
}
