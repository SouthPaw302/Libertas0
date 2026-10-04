import {
  MidiMappingEngine,
  type MidiAction,
  type MidiBinding,
} from './MidiMappingEngine';

type NavigatorMidiOptional = Navigator & {
  requestMIDIAccess?: () => Promise<MIDIAccess>;
};

export interface MidiRuntimeStatus {
  apiAvailable: boolean;
  connected: boolean;
  inputCount: number;
  inputs: Array<{ id: string; name: string; manufacturer: string }>;
  bindings: MidiBinding[];
}

export class WebMidiController {
  private access: MIDIAccess | null = null;

  constructor(
    private readonly engine: MidiMappingEngine,
    private readonly onAction: (action: MidiAction) => void,
  ) {}

  apiAvailable(): boolean {
    return typeof (navigator as NavigatorMidiOptional).requestMIDIAccess === 'function';
  }

  async connect(): Promise<MidiRuntimeStatus> {
    const request = (navigator as NavigatorMidiOptional).requestMIDIAccess;
    if (!request) throw new Error('Web MIDI API is unavailable in this browser');
    this.access = await request.call(navigator);
    this.bindInputs();
    this.access.onstatechange = () => this.bindInputs();
    return this.status();
  }

  dispatchSynthetic(data: number[]): { actions: MidiAction[]; learned?: MidiBinding } {
    const result = this.engine.process(data);
    for (const action of result.actions) this.onAction(action);
    return result;
  }

  status(): MidiRuntimeStatus {
    const inputs = this.access
      ? [...this.access.inputs.values()].map((input) => ({
          id: input.id,
          name: input.name ?? '',
          manufacturer: input.manufacturer ?? '',
        }))
      : [];
    return {
      apiAvailable: this.apiAvailable(),
      connected: this.access !== null,
      inputCount: inputs.length,
      inputs,
      bindings: this.engine.listBindings(),
    };
  }

  private bindInputs(): void {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (event) => {
        if (!event.data) return;
        const result = this.engine.process(event.data);
        for (const action of result.actions) this.onAction(action);
      };
    }
  }
}
