import {
  MidiMappingEngine,
  type MidiAction,
  type MidiBinding,
} from './MidiMappingEngine';

interface MidiInputLike {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  onmidimessage: ((event: { data: Uint8Array }) => void) | null;
}

interface MidiAccessLike {
  inputs: Map<string, MidiInputLike>;
  onstatechange: (() => void) | null;
}

interface NavigatorWithMidi extends Navigator {
  requestMIDIAccess?: () => Promise<MidiAccessLike>;
}

export interface MidiRuntimeStatus {
  apiAvailable: boolean;
  connected: boolean;
  inputCount: number;
  inputs: Array<{ id: string; name: string; manufacturer: string }>;
  bindings: MidiBinding[];
}

export class WebMidiController {
  private access: MidiAccessLike | null = null;

  constructor(
    private readonly engine: MidiMappingEngine,
    private readonly onAction: (action: MidiAction) => void,
  ) {}

  apiAvailable(): boolean {
    return typeof (navigator as NavigatorWithMidi).requestMIDIAccess === 'function';
  }

  async connect(): Promise<MidiRuntimeStatus> {
    const request = (navigator as NavigatorWithMidi).requestMIDIAccess;
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
        const result = this.engine.process(event.data);
        for (const action of result.actions) this.onAction(action);
      };
    }
  }
}
