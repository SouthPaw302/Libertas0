import { BrowserAudioRuntime } from '../audio/BrowserAudioRuntime';

export interface DecodedPcm {
  provider: string;
  sampleRate: number;
  channelCount: 1 | 2;
  frameCount: number;
  durationSeconds: number;
  channels: Float32Array[];
}

export interface PcmDecoder {
  readonly id: string;
  decode(encoded: ArrayBuffer): Promise<DecodedPcm>;
}

export class DecodeAudioDataProvider implements PcmDecoder {
  readonly id = 'web-audio.decodeAudioData';

  constructor(private readonly runtime: BrowserAudioRuntime) {}

  async decode(encoded: ArrayBuffer): Promise<DecodedPcm> {
    await this.runtime.initialize();
    const audioBuffer = await this.runtime.context.decodeAudioData(encoded.slice(0));

    if (audioBuffer.numberOfChannels !== 1 && audioBuffer.numberOfChannels !== 2) {
      throw new Error(
        `Deck A v1 accepts mono/stereo PCM only; decoded ${audioBuffer.numberOfChannels} channels`,
      );
    }

    const channels: Float32Array[] = [];
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const copy = new Float32Array(audioBuffer.length);
      audioBuffer.copyFromChannel(copy, channel);
      channels.push(copy);
    }

    return {
      provider: this.id,
      sampleRate: audioBuffer.sampleRate,
      channelCount: audioBuffer.numberOfChannels as 1 | 2,
      frameCount: audioBuffer.length,
      durationSeconds: audioBuffer.duration,
      channels,
    };
  }
}
