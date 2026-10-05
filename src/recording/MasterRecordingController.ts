import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';
import { MixerController } from '../mixer/MixerController';

export interface RecordingStatus {
  supported: boolean;
  state: RecordingState;
  mimeType: string | null;
  bytes: number;
  durationSeconds: number;
}

type RecordingState = 'idle' | 'recording' | 'stopping' | 'ready';

export class MasterRecordingController {
  private destination: MediaStreamAudioDestinationNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private state: RecordingState = 'idle';
  private startedAt = 0;
  private completedDurationSeconds = 0;
  private lastBlob: Blob | null = null;

  constructor(
    private readonly runtime: BrowserAudioRuntime,
    private readonly mixer: MixerController,
  ) {}

  supported(): boolean {
    return typeof MediaRecorder !== 'undefined';
  }

  start(): RecordingStatus {
    if (!this.supported()) throw new Error('MediaRecorder is unavailable');
    if (this.state === 'recording' || this.state === 'stopping') {
      throw new Error('Master recording is already active');
    }

    const context = this.runtime.context;
    if (!this.destination) {
      this.destination = context.createMediaStreamDestination();
      this.mixer.connectOutput(this.destination);
    }

    const mimeType = this.chooseMimeType();
    this.chunks = [];
    this.completedDurationSeconds = 0;
    this.lastBlob = null;
    this.recorder = mimeType
      ? new MediaRecorder(this.destination.stream, { mimeType })
      : new MediaRecorder(this.destination.stream);

    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start(200);
    this.startedAt = context.currentTime;
    this.state = 'recording';
    return this.status();
  }

  stop(): Promise<{ status: RecordingStatus; blob: Blob }> {
    if (!this.recorder || this.state !== 'recording') {
      return Promise.reject(new Error('Master recording is not active'));
    }

    const recorder = this.recorder;
    const context = this.runtime.context;
    this.state = 'stopping';
    return new Promise((resolve, reject) => {
      recorder.onerror = () => reject(new Error('MediaRecorder failed'));
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: recorder.mimeType || this.chunks[0]?.type || 'audio/webm',
        });
        this.lastBlob = blob;
        this.completedDurationSeconds = Math.max(0, context.currentTime - this.startedAt);
        this.state = 'ready';
        resolve({ status: this.status(), blob });
      };
      recorder.stop();
    });
  }

  status(): RecordingStatus {
    return {
      supported: this.supported(),
      state: this.state,
      mimeType: this.recorder?.mimeType || this.lastBlob?.type || null,
      bytes: this.lastBlob?.size ?? this.chunks.reduce((sum, chunk) => sum + chunk.size, 0),
      durationSeconds:
        this.state === 'ready'
          ? this.completedDurationSeconds
          : this.startedAt > 0
            ? Math.max(0, this.runtime.context.currentTime - this.startedAt)
            : 0,
    };
  }

  lastRecording(): Blob | null {
    return this.lastBlob;
  }

  close(): void {
    if (this.recorder?.state === 'recording') this.recorder.stop();
    if (this.destination) this.mixer.disconnectOutput(this.destination);
    this.destination?.disconnect();
    this.destination = null;
    this.recorder = null;
    this.chunks = [];
    this.completedDurationSeconds = 0;
    this.lastBlob = null;
    this.state = 'idle';
  }

  private chooseMimeType(): string {
    for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  }
}
