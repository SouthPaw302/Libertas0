import { describe, expect, it } from 'vitest';
import { MidiMappingEngine, decodeMidiMessage } from './MidiMappingEngine';

describe('MIDI mapping', () => {
  it('decodes CC and note-on messages', () => {
    expect(decodeMidiMessage([0xb0, 7, 127])).toMatchObject({
      kind: 'cc', channel: 1, number: 7, value: 127, normalized: 1,
    });
    expect(decodeMidiMessage([0x92, 60, 64])).toMatchObject({
      kind: 'note', channel: 3, number: 60, value: 64,
    });
    expect(decodeMidiMessage([0x82, 60, 64])).toBeNull();
  });

  it('learns and applies an absolute mapping', () => {
    const engine = new MidiMappingEngine();
    engine.startLearn('mixer.crossfader', 'absolute', -1, 1);
    const learned = engine.process([0xb0, 10, 0]);
    expect(learned.learned?.target).toBe('mixer.crossfader');
    expect(learned.actions[0]?.value).toBe(-1);

    const high = engine.process([0xb0, 10, 127]);
    expect(high.actions[0]?.value).toBe(1);
  });

  it('maps note-on as a trigger action', () => {
    const engine = new MidiMappingEngine();
    engine.addBinding({
      id: 'hotcue',
      kind: 'note',
      channel: 1,
      number: 36,
      target: 'deckA.hotcue1',
      mode: 'trigger',
    });
    expect(engine.process([0x90, 36, 100]).actions[0]).toMatchObject({
      target: 'deckA.hotcue1',
      trigger: true,
    });
  });
});
