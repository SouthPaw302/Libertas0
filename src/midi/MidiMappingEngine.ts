export type MidiMessageKind = 'cc' | 'note';

export interface DecodedMidiMessage {
  kind: MidiMessageKind;
  channel: number;
  number: number;
  value: number;
  normalized: number;
}

export interface MidiBinding {
  id: string;
  kind: MidiMessageKind;
  channel: number;
  number: number;
  target: string;
  mode: 'absolute' | 'trigger';
  min?: number;
  max?: number;
  inputId?: string;
}

export interface MidiAction {
  bindingId: string;
  target: string;
  value: number;
  trigger: boolean;
  message: DecodedMidiMessage;
  sourceInputId?: string;
}

interface MidiLearnTarget {
  target: string;
  mode: 'absolute' | 'trigger';
  min?: number;
  max?: number;
  inputId?: string | 'source';
}

export function decodeMidiMessage(data: ArrayLike<number>): DecodedMidiMessage | null {
  if (data.length < 3) return null;
  const status = Number(data[0]) & 0xff;
  const type = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  const number = Number(data[1]) & 0x7f;
  const value = Number(data[2]) & 0x7f;

  if (type === 0xb0) {
    return { kind: 'cc', channel, number, value, normalized: value / 127 };
  }
  if (type === 0x90 && value > 0) {
    return { kind: 'note', channel, number, value, normalized: value / 127 };
  }
  return null;
}

export class MidiMappingEngine {
  private readonly bindings = new Map<string, MidiBinding>();
  private learnTarget: MidiLearnTarget | null = null;

  addBinding(binding: MidiBinding): void {
    if (binding.channel < 1 || binding.channel > 16) throw new RangeError('MIDI channel must be 1..16');
    if (binding.number < 0 || binding.number > 127) throw new RangeError('MIDI number must be 0..127');
    if (!binding.id.trim()) throw new Error('MIDI binding id is required');
    if (!binding.target.trim()) throw new Error('MIDI binding target is required');
    this.bindings.set(binding.id, { ...binding });
  }

  replaceBindings(bindings: MidiBinding[]): void {
    this.bindings.clear();
    for (const binding of bindings) this.addBinding(binding);
  }

  clearBindings(): void {
    this.bindings.clear();
  }

  removeBinding(id: string): void {
    this.bindings.delete(id);
  }

  startLearn(
    target: string,
    mode: 'absolute' | 'trigger',
    min?: number,
    max?: number,
    inputId?: string | 'source',
  ): void {
    this.learnTarget = {
      target,
      mode,
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
      ...(inputId === undefined ? {} : { inputId }),
    };
  }

  cancelLearn(): void {
    this.learnTarget = null;
  }

  process(
    data: ArrayLike<number>,
    sourceInputId?: string,
  ): { actions: MidiAction[]; learned?: MidiBinding } {
    const message = decodeMidiMessage(data);
    if (!message) return { actions: [] };

    let learned: MidiBinding | undefined;
    if (this.learnTarget) {
      const learnedInputId = this.learnTarget.inputId === 'source'
        ? sourceInputId
        : this.learnTarget.inputId;
      learned = {
        id: [
          learnedInputId ? `input:${learnedInputId}` : 'input:any',
          message.kind,
          message.channel,
          message.number,
          '->',
          this.learnTarget.target,
        ].join(':'),
        kind: message.kind,
        channel: message.channel,
        number: message.number,
        target: this.learnTarget.target,
        mode: this.learnTarget.mode,
        ...(this.learnTarget.min === undefined ? {} : { min: this.learnTarget.min }),
        ...(this.learnTarget.max === undefined ? {} : { max: this.learnTarget.max }),
        ...(learnedInputId === undefined ? {} : { inputId: learnedInputId }),
      };
      this.addBinding(learned);
      this.learnTarget = null;
    }

    const actions: MidiAction[] = [];
    for (const binding of this.bindings.values()) {
      if (
        binding.kind !== message.kind ||
        binding.channel !== message.channel ||
        binding.number !== message.number ||
        (binding.inputId !== undefined && binding.inputId !== sourceInputId)
      ) continue;

      if (binding.mode === 'trigger') {
        actions.push({
          bindingId: binding.id,
          target: binding.target,
          value: 1,
          trigger: true,
          message,
          ...(sourceInputId === undefined ? {} : { sourceInputId }),
        });
        continue;
      }

      const min = binding.min ?? 0;
      const max = binding.max ?? 1;
      actions.push({
        bindingId: binding.id,
        target: binding.target,
        value: min + message.normalized * (max - min),
        trigger: false,
        message,
        ...(sourceInputId === undefined ? {} : { sourceInputId }),
      });
    }
    return { actions, ...(learned ? { learned } : {}) };
  }

  listBindings(): MidiBinding[] {
    return [...this.bindings.values()].map((binding) => ({ ...binding }));
  }
}
