import type { MidiBinding } from './MidiMappingEngine';

export type MidiFeedbackMode = 'scaled' | 'binary' | 'pulse';

export interface MidiFeedbackBinding {
  id: string;
  target: string;
  kind: 'cc' | 'note';
  channel: number;
  number: number;
  outputId?: string;
  mode: MidiFeedbackMode;
  min?: number;
  max?: number;
  onValue?: number;
  offValue?: number;
}

export interface MidiControllerProfile {
  id: string;
  name: string;
  bindings: MidiBinding[];
  feedback: MidiFeedbackBinding[];
  createdAt: number;
  updatedAt: number;
}

interface MidiProfileState {
  version: 1;
  activeProfileId: string | null;
  profiles: MidiControllerProfile[];
}

export interface MidiProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'libertas0-midi-profiles-v1';

function cloneProfile(profile: MidiControllerProfile): MidiControllerProfile {
  return {
    ...profile,
    bindings: profile.bindings.map((binding) => ({ ...binding })),
    feedback: profile.feedback.map((binding) => ({ ...binding })),
  };
}

export class MidiProfileStore {
  constructor(private readonly storage: MidiProfileStorage = window.localStorage) {}

  list(): MidiControllerProfile[] {
    return this.state().profiles.map(cloneProfile);
  }

  get(id: string): MidiControllerProfile | null {
    const profile = this.state().profiles.find((candidate) => candidate.id === id);
    return profile ? cloneProfile(profile) : null;
  }

  active(): MidiControllerProfile | null {
    const state = this.state();
    if (!state.activeProfileId) return null;
    const profile = state.profiles.find((candidate) => candidate.id === state.activeProfileId);
    return profile ? cloneProfile(profile) : null;
  }

  save(input: {
    id?: string;
    name: string;
    bindings: MidiBinding[];
    feedback: MidiFeedbackBinding[];
  }): MidiControllerProfile {
    const name = input.name.trim();
    if (!name) throw new Error('MIDI profile name is required');
    const state = this.state();
    const now = Date.now();
    const id = input.id ?? `midi-profile-${now.toString(36)}`;
    const existingIndex = state.profiles.findIndex((profile) => profile.id === id);
    const existing = existingIndex >= 0 ? state.profiles[existingIndex] : null;
    const profile: MidiControllerProfile = {
      id,
      name,
      bindings: input.bindings.map((binding) => ({ ...binding })),
      feedback: input.feedback.map((binding) => ({ ...binding })),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existingIndex >= 0) state.profiles[existingIndex] = profile;
    else state.profiles.push(profile);
    this.write(state);
    return cloneProfile(profile);
  }

  activate(id: string | null): MidiControllerProfile | null {
    const state = this.state();
    if (id !== null && !state.profiles.some((profile) => profile.id === id)) {
      throw new Error(`MIDI profile not found: ${id}`);
    }
    state.activeProfileId = id;
    this.write(state);
    return id === null ? null : this.get(id);
  }

  remove(id: string): void {
    const state = this.state();
    state.profiles = state.profiles.filter((profile) => profile.id !== id);
    if (state.activeProfileId === id) state.activeProfileId = null;
    this.write(state);
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }

  private state(): MidiProfileState {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, activeProfileId: null, profiles: [] };
    try {
      const parsed = JSON.parse(raw) as MidiProfileState;
      if (parsed.version !== 1 || !Array.isArray(parsed.profiles)) {
        return { version: 1, activeProfileId: null, profiles: [] };
      }
      return parsed;
    } catch {
      return { version: 1, activeProfileId: null, profiles: [] };
    }
  }

  private write(state: MidiProfileState): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
