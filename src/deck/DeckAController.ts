import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import {
  DeckController,
  type DeckOutputTarget,
  type DeckProcessorStatus,
  type DeckStatus,
} from './DeckController';
import type { PcmDecoder } from './PcmDecoder';

export type DeckAProcessorStatus = DeckProcessorStatus;
export type DeckAStatus = DeckStatus;

export class DeckAController extends DeckController {
  constructor(runtime: BrowserAudioRuntime, decoder?: PcmDecoder, outputTarget?: DeckOutputTarget) {
    super(runtime, 'A', decoder, outputTarget);
  }
}
