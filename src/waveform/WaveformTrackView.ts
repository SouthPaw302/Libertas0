import type { DeckStatus } from '../deck/DeckController';
import type { BeatGrid } from '../music/MusicalClock';
import {
  beatFramesInRange,
  detailFrameRange,
  frameToX,
  markerFrames,
  type FrameRange,
  type WaveformEnvelope,
} from './WaveformData';

export interface WaveformRenderSnapshot {
  loaded: boolean;
  sourceFrame: number;
  sourceFrames: number;
  sampleRate: number;
  overviewPlayheadX: number;
  detailPlayheadX: number;
  detailStartFrame: number;
  detailEndFrame: number;
  beatLineCount: number;
  cueVisible: boolean;
  hotCueCount: number;
  loopVisible: boolean;
}

export class WaveformTrackView {
  private lastSnapshot: WaveformRenderSnapshot = {
    loaded: false,
    sourceFrame: 0,
    sourceFrames: 0,
    sampleRate: 0,
    overviewPlayheadX: 0,
    detailPlayheadX: 0,
    detailStartFrame: 0,
    detailEndFrame: 0,
    beatLineCount: 0,
    cueVisible: false,
    hotCueCount: 0,
    loopVisible: false,
  };

  constructor(
    private readonly overview: HTMLCanvasElement,
    private readonly detail: HTMLCanvasElement,
  ) {}

  render(envelope: WaveformEnvelope | null, status: DeckStatus, grid: BeatGrid): WaveformRenderSnapshot {
    this.resizeCanvas(this.overview);
    this.resizeCanvas(this.detail);

    if (!envelope || !status.loaded || status.sourceFrames <= 0) {
      this.clear(this.overview, 'Load a track to display waveform');
      this.clear(this.detail, 'Scrolling waveform');
      this.lastSnapshot = {
        loaded: false,
        sourceFrame: status.sourceFrame,
        sourceFrames: status.sourceFrames,
        sampleRate: status.sourceSampleRate,
        overviewPlayheadX: 0,
        detailPlayheadX: 0,
        detailStartFrame: 0,
        detailEndFrame: 0,
        beatLineCount: 0,
        cueVisible: false,
        hotCueCount: 0,
        loopVisible: false,
      };
      return this.lastSnapshot;
    }

    const overviewRange = { startFrame: 0, endFrame: status.sourceFrames };
    const detailRange = detailFrameRange(
      status.sourceFrame,
      status.sourceFrames,
      status.sourceSampleRate,
      12,
    );
    const markers = markerFrames(status);
    const detailBeats = beatFramesInRange(grid, status.sourceSampleRate, detailRange);

    this.drawWaveform(this.overview, envelope, overviewRange, status, grid, false);
    this.drawWaveform(this.detail, envelope, detailRange, status, grid, true);

    this.lastSnapshot = {
      loaded: true,
      sourceFrame: status.sourceFrame,
      sourceFrames: status.sourceFrames,
      sampleRate: status.sourceSampleRate,
      overviewPlayheadX: frameToX(status.sourceFrame, overviewRange, this.overview.width),
      detailPlayheadX: frameToX(status.sourceFrame, detailRange, this.detail.width),
      detailStartFrame: detailRange.startFrame,
      detailEndFrame: detailRange.endFrame,
      beatLineCount: detailBeats.length,
      cueVisible: markers.cueFrame !== null && markers.cueFrame >= detailRange.startFrame && markers.cueFrame <= detailRange.endFrame,
      hotCueCount: markers.hotCueFrames.filter((frame) => frame >= detailRange.startFrame && frame <= detailRange.endFrame).length,
      loopVisible: Boolean(
        markers.loopEnabled &&
        markers.loopStartFrame !== null &&
        markers.loopEndFrame !== null &&
        markers.loopEndFrame >= detailRange.startFrame &&
        markers.loopStartFrame <= detailRange.endFrame
      ),
    };
    return this.lastSnapshot;
  }

  snapshot(): WaveformRenderSnapshot {
    return { ...this.lastSnapshot };
  }

  private drawWaveform(
    canvas: HTMLCanvasElement,
    envelope: WaveformEnvelope,
    range: FrameRange,
    status: DeckStatus,
    grid: BeatGrid,
    showBeatGrid: boolean,
  ): void {
    const context = canvas.getContext('2d');
    if (!context) return;
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);

    context.fillStyle = '#090b0f';
    context.fillRect(0, 0, width, height);

    if (showBeatGrid) {
      const beats = beatFramesInRange(grid, status.sourceSampleRate, range);
      const framesPerBeat = (status.sourceSampleRate * 60) / grid.bpm;
      for (const beatFrame of beats) {
        const beatIndex = Math.round((beatFrame - grid.firstBeatFrame) / framesPerBeat);
        const bar = beatIndex % (grid.beatsPerBar ?? 4) === 0;
        const x = frameToX(beatFrame, range, width);
        context.strokeStyle = bar ? '#4f617d' : '#27313e';
        context.lineWidth = bar ? 1.5 : 1;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
    }

    const center = height / 2;
    context.strokeStyle = '#8ea7cf';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x < width; x += 1) {
      const frame = range.startFrame + (x / Math.max(1, width - 1)) * (range.endFrame - range.startFrame);
      const bucket = Math.max(0, Math.min(envelope.buckets - 1, Math.floor((frame / Math.max(1, envelope.sourceFrames)) * envelope.buckets)));
      const yTop = center - envelope.max[bucket] * center * 0.88;
      const yBottom = center - envelope.min[bucket] * center * 0.88;
      context.moveTo(x + 0.5, yTop);
      context.lineTo(x + 0.5, yBottom);
    }
    context.stroke();

    const markers = markerFrames(status);
    if (markers.loopEnabled && markers.loopStartFrame !== null && markers.loopEndFrame !== null) {
      const startX = frameToX(markers.loopStartFrame, range, width);
      const endX = frameToX(markers.loopEndFrame, range, width);
      if (endX >= 0 && startX <= width) {
        context.fillStyle = 'rgba(130, 160, 110, 0.16)';
        context.fillRect(Math.max(0, startX), 0, Math.max(1, Math.min(width, endX) - Math.max(0, startX)), height);
        this.line(context, startX, height, '#93b77d', 2);
        this.line(context, endX, height, '#93b77d', 2);
      }
    }

    if (markers.cueFrame !== null) this.line(context, frameToX(markers.cueFrame, range, width), height, '#e7c56f', 2);
    markers.hotCueFrames.forEach((frame, index) => {
      const x = frameToX(frame, range, width);
      if (x >= 0 && x <= width) {
        this.line(context, x, height, '#d58f8f', 1.5);
        context.fillStyle = '#d58f8f';
        context.font = '11px system-ui';
        context.fillText(String(index + 1), x + 3, 12);
      }
    });

    const playheadX = frameToX(status.sourceFrame, range, width);
    this.line(context, playheadX, height, '#ffffff', 2);
  }

  private line(context: CanvasRenderingContext2D, x: number, height: number, color: string, width: number): void {
    if (x < 0 || x > context.canvas.width) return;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  private clear(canvas: HTMLCanvasElement, message: string): void {
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#090b0f';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#7f8998';
    context.font = '12px system-ui';
    context.fillText(message, 10, Math.max(18, canvas.height / 2));
  }

  private resizeCanvas(canvas: HTMLCanvasElement): void {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const cssWidth = Math.max(1, Math.floor(canvas.clientWidth));
    const cssHeight = Math.max(1, Math.floor(canvas.clientHeight));
    const width = Math.floor(cssWidth * ratio);
    const height = Math.floor(cssHeight * ratio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }
}
