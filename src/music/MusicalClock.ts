export interface BeatGrid {
  bpm: number;
  firstBeatFrame: number;
  beatsPerBar: number;
  beatUnit: number;
}

export interface MusicalPosition {
  sourceFrame: number;
  beatPosition: number;
  beatIndex: number;
  beatInBar: number;
  barIndex: number;
  beatPhase: number;
  barPhase: number;
  framesPerBeat: number;
}

export type QuantizeDirection = 'previous' | 'nearest' | 'next';

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

export function validateBeatGrid(grid: BeatGrid): BeatGrid {
  assertFinite('bpm', grid.bpm);
  assertFinite('firstBeatFrame', grid.firstBeatFrame);

  if (grid.bpm <= 0 || grid.bpm > 1000) {
    throw new RangeError('bpm must be greater than 0 and no more than 1000');
  }
  if (!Number.isInteger(grid.beatsPerBar) || grid.beatsPerBar <= 0 || grid.beatsPerBar > 32) {
    throw new RangeError('beatsPerBar must be an integer between 1 and 32');
  }
  if (!Number.isInteger(grid.beatUnit) || ![1, 2, 4, 8, 16, 32].includes(grid.beatUnit)) {
    throw new RangeError('beatUnit must be one of 1, 2, 4, 8, 16, 32');
  }

  return { ...grid };
}

export function framesPerBeat(sampleRate: number, bpm: number): number {
  assertFinite('sampleRate', sampleRate);
  assertFinite('bpm', bpm);
  if (sampleRate <= 0) throw new RangeError('sampleRate must be positive');
  if (bpm <= 0) throw new RangeError('bpm must be positive');
  return (sampleRate * 60) / bpm;
}

export function sourceFrameToBeatPosition(
  sourceFrame: number,
  sampleRate: number,
  grid: BeatGrid,
): number {
  assertFinite('sourceFrame', sourceFrame);
  const valid = validateBeatGrid(grid);
  return (sourceFrame - valid.firstBeatFrame) / framesPerBeat(sampleRate, valid.bpm);
}

export function beatPositionToSourceFrame(
  beatPosition: number,
  sampleRate: number,
  grid: BeatGrid,
): number {
  assertFinite('beatPosition', beatPosition);
  const valid = validateBeatGrid(grid);
  return valid.firstBeatFrame + beatPosition * framesPerBeat(sampleRate, valid.bpm);
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function sourceFrameToMusicalPosition(
  sourceFrame: number,
  sampleRate: number,
  grid: BeatGrid,
): MusicalPosition {
  const valid = validateBeatGrid(grid);
  const fpb = framesPerBeat(sampleRate, valid.bpm);
  const beatPosition = (sourceFrame - valid.firstBeatFrame) / fpb;
  const beatIndex = Math.floor(beatPosition);
  const beatPhase = beatPosition - beatIndex;
  const beatInBar = positiveModulo(beatIndex, valid.beatsPerBar);
  const barIndex = Math.floor(beatIndex / valid.beatsPerBar);
  const barPhase = (beatInBar + beatPhase) / valid.beatsPerBar;

  return {
    sourceFrame,
    beatPosition,
    beatIndex,
    beatInBar,
    barIndex,
    beatPhase,
    barPhase,
    framesPerBeat: fpb,
  };
}

export function quantizeSourceFrame(
  sourceFrame: number,
  sampleRate: number,
  grid: BeatGrid,
  quantumBeats = 1,
  direction: QuantizeDirection = 'nearest',
): number {
  assertFinite('quantumBeats', quantumBeats);
  if (quantumBeats <= 0) throw new RangeError('quantumBeats must be positive');

  const beatPosition = sourceFrameToBeatPosition(sourceFrame, sampleRate, grid);
  const scaled = beatPosition / quantumBeats;

  let quantizedScaled: number;
  switch (direction) {
    case 'previous':
      quantizedScaled = Math.floor(scaled);
      break;
    case 'next':
      quantizedScaled = Math.ceil(scaled);
      break;
    case 'nearest':
      quantizedScaled = Math.round(scaled);
      break;
    default:
      throw new Error(`unknown quantize direction: ${String(direction)}`);
  }

  return beatPositionToSourceFrame(quantizedScaled * quantumBeats, sampleRate, grid);
}

export class MusicalClock {
  private grid: BeatGrid;

  constructor(
    private readonly sampleRate: number,
    grid: BeatGrid,
  ) {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new RangeError('sampleRate must be positive');
    }
    this.grid = validateBeatGrid(grid);
  }

  setGrid(grid: BeatGrid): void {
    this.grid = validateBeatGrid(grid);
  }

  getGrid(): BeatGrid {
    return { ...this.grid };
  }

  positionAt(sourceFrame: number): MusicalPosition {
    return sourceFrameToMusicalPosition(sourceFrame, this.sampleRate, this.grid);
  }

  sourceFrameAtBeat(beatPosition: number): number {
    return beatPositionToSourceFrame(beatPosition, this.sampleRate, this.grid);
  }

  quantize(sourceFrame: number, quantumBeats = 1, direction: QuantizeDirection = 'nearest'): number {
    return quantizeSourceFrame(sourceFrame, this.sampleRate, this.grid, quantumBeats, direction);
  }
}
