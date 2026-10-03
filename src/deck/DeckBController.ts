import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import { DeckController, type DeckOutputTarget, type DeckStatus } from './DeckController';
import type { PcmDecoder } from './PcmDecoder';

export type DeckBStatus = DeckStatus;

export class DeckBController extends DeckController {
  constructor(runtime: BrowserAudioRuntime, decoder?: PcmDecoder, outputTarget?: DeckOutputTarget) {
    super(runtime, 'B', decoder, outputTarget);
  }
}
