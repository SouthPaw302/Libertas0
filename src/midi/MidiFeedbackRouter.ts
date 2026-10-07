import type { MidiFeedbackBinding } from './MidiProfileStore';

export interface MidiFeedbackMessage {
  bindingId: string;
  outputId?: string;
  data: [number, number, number];
  timestamp?: number;
}

type SendFeedback = (message: MidiFeedbackMessage) => void;
type Now = () => number;

function clampMidi(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function statusByte(kind: 'cc' | 'note', channel: number): number {
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) {
    throw new RangeError('MIDI feedback channel must be 1..16');
  }
  return (kind === 'cc' ? 0xb0 : 0x90) | (channel - 1);
}

export class MidiFeedbackRouter {
  private bindings: MidiFeedbackBinding[] = [];

  constructor(
    private readonly send: SendFeedback,
    private readonly now: Now = () => performance.now(),
  ) {}

  replaceBindings(bindings: MidiFeedbackBinding[]): void {
    this.bindings = bindings.map((binding) => ({ ...binding }));
  }

  listBindings(): MidiFeedbackBinding[] {
    return this.bindings.map((binding) => ({ ...binding }));
  }

  publish(target: string, value: number): MidiFeedbackMessage[] {
    const messages: MidiFeedbackMessage[] = [];
    for (const binding of this.bindings) {
      if (binding.target !== target || binding.mode === 'pulse') continue;
      const min = binding.min ?? 0;
      const max = binding.max ?? 1;
      const normalized = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
      const midiValue = binding.mode === 'binary'
        ? (normalized >= 0.5 ? (binding.onValue ?? 127) : (binding.offValue ?? 0))
        : normalized * 127;
      const message = this.makeMessage(binding, clampMidi(midiValue));
      this.send(message);
      messages.push(message);
    }
    return messages;
  }

  pulse(target: string, durationMs = 70): MidiFeedbackMessage[] {
    const messages: MidiFeedbackMessage[] = [];
    const now = this.now();
    for (const binding of this.bindings) {
      if (binding.target !== target || binding.mode !== 'pulse') continue;
      const on = this.makeMessage(binding, binding.onValue ?? 127);
      const off = this.makeMessage(binding, binding.offValue ?? 0, now + Math.max(1, durationMs));
      this.send(on);
      this.send(off);
      messages.push(on, off);
    }
    return messages;
  }

  private makeMessage(
    binding: MidiFeedbackBinding,
    value: number,
    timestamp?: number,
  ): MidiFeedbackMessage {
    if (!Number.isInteger(binding.number) || binding.number < 0 || binding.number > 127) {
      throw new RangeError('MIDI feedback number must be 0..127');
    }
    return {
      bindingId: binding.id,
      ...(binding.outputId === undefined ? {} : { outputId: binding.outputId }),
      data: [statusByte(binding.kind, binding.channel), binding.number, clampMidi(value)],
      ...(timestamp === undefined ? {} : { timestamp }),
    };
  }
}
