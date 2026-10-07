import {
  MidiMappingEngine,
  type MidiAction,
  type MidiBinding,
} from './MidiMappingEngine';

type NavigatorMidiOptional = Navigator & {
  requestMIDIAccess?: () => Promise<MIDIAccess>;
};

export interface MidiPortStatus {
  id: string;
  name: string;
  manufacturer: string;
  state: MIDIPortDeviceState;
  connection: MIDIPortConnectionState;
}

export interface MidiRuntimeStatus {
  apiAvailable: boolean;
  connected: boolean;
  inputCount: number;
  outputCount: number;
  inputs: MidiPortStatus[];
  outputs: MidiPortStatus[];
  bindings: MidiBinding[];
}

export interface MidiDispatchResult {
  actions: MidiAction[];
  learned?: MidiBinding;
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

  dispatchSynthetic(data: number[], sourceInputId?: string): MidiDispatchResult {
    const result = this.engine.process(data, sourceInputId);
    for (const action of result.actions) this.onAction(action);
    return result;
  }

  send(outputId: string, data: number[], timestamp?: number): void {
    if (!this.access) throw new Error('Web MIDI is not connected');
    const output = this.access.outputs.get(outputId);
    if (!output) throw new Error(`MIDI output not found: ${outputId}`);
    output.send(data, timestamp);
  }

  sendAll(data: number[], timestamp?: number): void {
    if (!this.access) return;
    for (const output of this.access.outputs.values()) output.send(data, timestamp);
  }

  status(): MidiRuntimeStatus {
    const inputs = this.access
      ? [...this.access.inputs.values()].map((input) => this.portStatus(input))
      : [];
    const outputs = this.access
      ? [...this.access.outputs.values()].map((output) => this.portStatus(output))
      : [];
    return {
      apiAvailable: this.apiAvailable(),
      connected: this.access !== null,
      inputCount: inputs.length,
      outputCount: outputs.length,
      inputs,
      outputs,
      bindings: this.engine.listBindings(),
    };
  }

  close(): void {
    if (!this.access) return;
    this.access.onstatechange = null;
    for (const input of this.access.inputs.values()) input.onmidimessage = null;
    this.access = null;
  }

  private bindInputs(): void {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (event) => {
        if (!event.data) return;
        const result = this.engine.process(event.data, input.id);
        for (const action of result.actions) this.onAction(action);
      };
    }
  }

  private portStatus(port: MIDIPort): MidiPortStatus {
    return {
      id: port.id,
      name: port.name ?? '',
      manufacturer: port.manufacturer ?? '',
      state: port.state,
      connection: port.connection,
    };
  }
}
