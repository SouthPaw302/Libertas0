export interface MidiTargetDescriptor {
  target: string;
  label: string;
  group: 'mixer' | 'deck' | 'performance' | 'sync' | 'fx' | 'sampler' | 'monitor';
  mode: 'absolute' | 'trigger';
  min?: number;
  max?: number;
}

export const MIDI_TARGETS: MidiTargetDescriptor[] = [
  { target: 'mixer.crossfader', label: 'Mixer · Crossfader', group: 'mixer', mode: 'absolute', min: -1, max: 1 },
  { target: 'mixer.master', label: 'Mixer · Master', group: 'mixer', mode: 'absolute', min: 0, max: 1 },
  { target: 'channelA.trim', label: 'Deck A · Trim', group: 'mixer', mode: 'absolute', min: -12, max: 12 },
  { target: 'channelB.trim', label: 'Deck B · Trim', group: 'mixer', mode: 'absolute', min: -12, max: 12 },
  { target: 'channelA.filter', label: 'Deck A · Filter', group: 'mixer', mode: 'absolute', min: -1, max: 1 },
  { target: 'channelB.filter', label: 'Deck B · Filter', group: 'mixer', mode: 'absolute', min: -1, max: 1 },
  { target: 'deckA.volume', label: 'Deck A · Volume', group: 'deck', mode: 'absolute', min: 0, max: 1 },
  { target: 'deckB.volume', label: 'Deck B · Volume', group: 'deck', mode: 'absolute', min: 0, max: 1 },
  { target: 'deckA.playPause', label: 'Deck A · Play/Pause', group: 'deck', mode: 'trigger' },
  { target: 'deckB.playPause', label: 'Deck B · Play/Pause', group: 'deck', mode: 'trigger' },
  { target: 'deckA.cue', label: 'Deck A · Cue', group: 'performance', mode: 'trigger' },
  { target: 'deckB.cue', label: 'Deck B · Cue', group: 'performance', mode: 'trigger' },
  { target: 'deckA.hotcue1', label: 'Deck A · Hot Cue 1', group: 'performance', mode: 'trigger' },
  { target: 'deckB.hotcue1', label: 'Deck B · Hot Cue 1', group: 'performance', mode: 'trigger' },
  { target: 'sync.a-to-b', label: 'SYNC · B to A', group: 'sync', mode: 'trigger' },
  { target: 'sync.b-to-a', label: 'SYNC · A to B', group: 'sync', mode: 'trigger' },
  { target: 'sync.disable', label: 'SYNC · Disable', group: 'sync', mode: 'trigger' },
  { target: 'fx.A.wet', label: 'FX · Deck A Wet', group: 'fx', mode: 'absolute', min: 0, max: 1 },
  { target: 'fx.B.wet', label: 'FX · Deck B Wet', group: 'fx', mode: 'absolute', min: 0, max: 1 },
  { target: 'fx.master.wet', label: 'FX · Master Wet', group: 'fx', mode: 'absolute', min: 0, max: 1 },
  { target: 'monitor.cueA', label: 'Monitor · Cue A Toggle', group: 'monitor', mode: 'trigger' },
  { target: 'monitor.cueB', label: 'Monitor · Cue B Toggle', group: 'monitor', mode: 'trigger' },
  ...Array.from({ length: 8 }, (_, index): MidiTargetDescriptor => ({
    target: `sampler.pad${index + 1}.trigger`,
    label: `Sampler · Pad ${index + 1}`,
    group: 'sampler',
    mode: 'trigger',
  })),
  ...Array.from({ length: 8 }, (_, index): MidiTargetDescriptor => ({
    target: `sampler.pad${index + 1}.gain`,
    label: `Sampler · Pad ${index + 1} Gain`,
    group: 'sampler',
    mode: 'absolute',
    min: 0,
    max: 1,
  })),
];

export function midiTarget(target: string): MidiTargetDescriptor | null {
  return MIDI_TARGETS.find((descriptor) => descriptor.target === target) ?? null;
}
