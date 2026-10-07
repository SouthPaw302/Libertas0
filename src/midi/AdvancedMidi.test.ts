import { describe, expect, it } from 'vitest';
import { MidiMappingEngine } from './MidiMappingEngine';
import { MidiFeedbackRouter } from './MidiFeedbackRouter';
import { MidiProfileStore, type MidiProfileStorage } from './MidiProfileStore';

class MemoryStorage implements MidiProfileStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('advanced MIDI mapping', () => {
  it('isolates identical controls from multiple input devices', () => {
    const engine = new MidiMappingEngine();
    engine.addBinding({
      id: 'a',
      kind: 'cc',
      channel: 1,
      number: 10,
      target: 'mixer.crossfader',
      mode: 'absolute',
      min: -1,
      max: 1,
      inputId: 'controller-a',
    });
    engine.addBinding({
      id: 'b',
      kind: 'cc',
      channel: 1,
      number: 10,
      target: 'fx.A.wet',
      mode: 'absolute',
      min: 0,
      max: 1,
      inputId: 'controller-b',
    });

    expect(engine.process([0xb0, 10, 127], 'controller-a').actions.map((action) => action.target))
      .toEqual(['mixer.crossfader']);
    expect(engine.process([0xb0, 10, 127], 'controller-b').actions.map((action) => action.target))
      .toEqual(['fx.A.wet']);
  });

  it('learns the physical source input when requested', () => {
    const engine = new MidiMappingEngine();
    engine.startLearn('mixer.master', 'absolute', 0, 1, 'source');
    const result = engine.process([0xb0, 7, 100], 'hardware-1');
    expect(result.learned?.inputId).toBe('hardware-1');
  });
});

describe('MIDI controller profiles', () => {
  it('persists and reactivates profiles', () => {
    const store = new MidiProfileStore(new MemoryStorage());
    const saved = store.save({
      name: 'Club Controller',
      bindings: [{
        id: 'xf',
        kind: 'cc',
        channel: 1,
        number: 10,
        target: 'mixer.crossfader',
        mode: 'absolute',
        min: -1,
        max: 1,
      }],
      feedback: [{
        id: 'play-led',
        target: 'deckA.playPause',
        kind: 'note',
        channel: 1,
        number: 1,
        mode: 'pulse',
      }],
    });
    store.activate(saved.id);
    expect(store.active()?.name).toBe('Club Controller');
    expect(store.active()?.feedback).toHaveLength(1);
  });
});

describe('MIDI LED/output feedback', () => {
  it('builds scaled and timed pulse messages deterministically', () => {
    const sent: unknown[] = [];
    const router = new MidiFeedbackRouter((message) => sent.push(message), () => 1000);
    router.replaceBindings([
      {
        id: 'wet-ring',
        target: 'fx.A.wet',
        kind: 'cc',
        channel: 2,
        number: 20,
        outputId: 'out-a',
        mode: 'scaled',
        min: 0,
        max: 1,
      },
      {
        id: 'pad-led',
        target: 'sampler.pad1.trigger',
        kind: 'note',
        channel: 1,
        number: 36,
        mode: 'pulse',
      },
    ]);

    const scaled = router.publish('fx.A.wet', 0.5);
    expect(scaled[0]?.data).toEqual([0xb1, 20, 64]);

    const pulse = router.pulse('sampler.pad1.trigger', 70);
    expect(pulse[0]?.data).toEqual([0x90, 36, 127]);
    expect(pulse[1]?.data).toEqual([0x90, 36, 0]);
    expect(pulse[1]?.timestamp).toBe(1070);
    expect(sent).toHaveLength(3);
  });
});
