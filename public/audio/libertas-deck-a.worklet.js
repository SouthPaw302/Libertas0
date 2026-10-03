class LibertasDeckAProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'volume',
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'playbackRate',
        defaultValue: 1,
        minValue: 0.25,
        maxValue: 4,
        automationRate: 'a-rate',
      },
    ];
  }

  constructor() {
    super();
    this.channels = [];
    this.decoderProvider = null;
    this.sourceFrame = 0;
    this.sourceFrames = 0;
    this.sourceChannels = 0;
    this.sourceSampleRate = 0;
    this.durationSeconds = 0;
    this.playing = false;
    this.ended = false;
    this.muted = false;

    this.processCalls = 0;
    this.processedOutputFrames = 0;
    this.frameDiscontinuities = 0;
    this.lastBlockEnd = null;
    this.lastRenderQuantum = 0;
    this.lastVolume = 1;
    this.lastPlaybackRate = 1;
    this.outputPeak = 0;

    this.port.onmessage = (event) => {
      const message = event.data || {};
      const requestId = Number(message.requestId);
      if (!Number.isInteger(requestId)) return;

      try {
        switch (message.type) {
          case 'load':
            this.load(message);
            break;
          case 'play':
            if (!this.sourceFrames) throw new Error('Deck A has no loaded PCM');
            if (this.sourceFrame >= this.sourceFrames) this.sourceFrame = 0;
            this.playing = true;
            this.ended = false;
            break;
          case 'pause':
            this.playing = false;
            break;
          case 'seek':
            if (!this.sourceFrames) throw new Error('Deck A has no loaded PCM');
            if (!Number.isFinite(message.frame)) throw new Error('seek frame must be finite');
            this.sourceFrame = Math.min(Math.max(Number(message.frame), 0), this.sourceFrames);
            this.ended = this.sourceFrame >= this.sourceFrames;
            break;
          case 'mute':
            this.muted = Boolean(message.muted);
            break;
          case 'status':
            break;
          default:
            throw new Error(`Unknown Deck A command: ${String(message.type)}`);
        }

        this.respond(requestId, true);
      } catch (error) {
        this.respond(requestId, false, error instanceof Error ? error.message : String(error));
      }
    };
  }

  load(message) {
    if (!Array.isArray(message.channelBuffers)) {
      throw new Error('Deck A load requires channelBuffers');
    }
    if (message.channelBuffers.length !== 1 && message.channelBuffers.length !== 2) {
      throw new Error('Deck A v1 accepts one or two PCM channels');
    }

    const channels = message.channelBuffers.map((buffer) => new Float32Array(buffer));
    const sourceFrames = Number(message.sourceFrames);
    if (!Number.isInteger(sourceFrames) || sourceFrames <= 0) {
      throw new Error('sourceFrames must be a positive integer');
    }
    if (channels.some((channel) => channel.length !== sourceFrames)) {
      throw new Error('PCM channel lengths do not match sourceFrames');
    }

    const sourceSampleRate = Number(message.sourceSampleRate);
    if (!Number.isFinite(sourceSampleRate) || sourceSampleRate <= 0) {
      throw new Error('sourceSampleRate must be positive');
    }

    this.channels = channels;
    this.decoderProvider = String(message.decoderProvider || 'unknown');
    this.sourceFrame = 0;
    this.sourceFrames = sourceFrames;
    this.sourceChannels = channels.length;
    this.sourceSampleRate = sourceSampleRate;
    this.durationSeconds = Number(message.durationSeconds) || sourceFrames / sourceSampleRate;
    this.playing = false;
    this.ended = false;
    this.outputPeak = 0;
  }

  respond(requestId, ok, error) {
    this.port.postMessage({
      type: 'response',
      requestId,
      ok,
      ...(error ? { error } : {}),
      outputCurrentFrame: Number(currentFrame),
      sampleRate: Number(sampleRate),
      renderQuantum: this.lastRenderQuantum,
      processCalls: this.processCalls,
      processedOutputFrames: this.processedOutputFrames,
      frameDiscontinuities: this.frameDiscontinuities,
      loaded: this.sourceFrames > 0,
      decoderProvider: this.decoderProvider,
      sourceFrame: this.sourceFrame,
      sourceFrames: this.sourceFrames,
      sourceChannels: this.sourceChannels,
      sourceSampleRate: this.sourceSampleRate,
      durationSeconds: this.durationSeconds,
      playing: this.playing,
      ended: this.ended,
      muted: this.muted,
      volume: this.lastVolume,
      playbackRate: this.lastPlaybackRate,
      outputPeak: this.outputPeak,
    });
  }

  sampleAt(channelIndex, position) {
    const channel = this.channels[channelIndex] || this.channels[0];
    if (!channel || channel.length === 0) return 0;

    const left = Math.min(Math.max(Math.floor(position), 0), channel.length - 1);
    const right = Math.min(left + 1, channel.length - 1);
    const fraction = Math.min(Math.max(position - left, 0), 1);
    return channel[left] + (channel[right] - channel[left]) * fraction;
  }

  process(_inputs, outputs, parameters) {
    const output = outputs[0] || [];
    const frameCount = output[0]?.length ?? 0;
    const blockStart = Number(currentFrame);

    if (this.lastBlockEnd !== null && blockStart !== this.lastBlockEnd) {
      this.frameDiscontinuities += 1;
    }

    const volumes = parameters.volume || [1];
    const rates = parameters.playbackRate || [1];
    let peak = 0;

    for (let i = 0; i < frameCount; i += 1) {
      const volume = this.muted ? 0 : (volumes.length === 1 ? volumes[0] : volumes[i]);
      const rate = rates.length === 1 ? rates[0] : rates[i];
      this.lastVolume = Number(volume);
      this.lastPlaybackRate = Number(rate);

      let left = 0;
      let right = 0;

      if (this.playing && this.sourceFrames > 0 && this.sourceFrame < this.sourceFrames) {
        left = this.sampleAt(0, this.sourceFrame) * volume;
        right = this.sampleAt(this.sourceChannels > 1 ? 1 : 0, this.sourceFrame) * volume;
        this.sourceFrame += rate;

        if (this.sourceFrame >= this.sourceFrames) {
          this.sourceFrame = this.sourceFrames;
          this.playing = false;
          this.ended = true;
        }
      }

      if (output[0]) output[0][i] = left;
      if (output[1]) output[1][i] = right;

      peak = Math.max(peak, Math.abs(left), Math.abs(right));
    }

    this.outputPeak = peak;
    this.processCalls += 1;
    this.processedOutputFrames += frameCount;
    this.lastRenderQuantum = frameCount;
    this.lastBlockEnd = blockStart + frameCount;
    return true;
  }
}

registerProcessor('libertas-deck-a', LibertasDeckAProcessor);
