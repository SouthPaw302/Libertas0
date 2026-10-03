class LibertasKernelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.signalRunning = false;
    this.frequencyHz = 220;
    this.gain = 0.03;
    this.processCalls = 0;
    this.processedFrames = 0;
    this.frameDiscontinuities = 0;
    this.lastBlockEnd = null;
    this.lastRenderQuantum = 0;

    this.port.onmessage = (event) => {
      const message = event.data || {};
      if (message.type === 'configure') {
        if (typeof message.signalRunning === 'boolean') this.signalRunning = message.signalRunning;
        if (Number.isFinite(message.frequencyHz) && message.frequencyHz > 0) {
          this.frequencyHz = message.frequencyHz;
        }
        if (Number.isFinite(message.gain) && message.gain >= 0 && message.gain <= 1) {
          this.gain = message.gain;
        }
        return;
      }

      if (message.type === 'status' && Number.isInteger(message.requestId)) {
        this.postStatus(message.requestId);
      }
    };
  }

  postStatus(requestId) {
    this.port.postMessage({
      type: 'status',
      requestId,
      currentFrame: Number(currentFrame),
      sampleRate: Number(sampleRate),
      renderQuantum: this.lastRenderQuantum,
      processedFrames: this.processedFrames,
      processCalls: this.processCalls,
      frameDiscontinuities: this.frameDiscontinuities,
      signalRunning: this.signalRunning,
      frequencyHz: this.frequencyHz,
      gain: this.gain,
    });
  }

  process(_inputs, outputs) {
    const output = outputs[0] || [];
    const frameCount = output[0]?.length ?? 0;
    const blockStart = Number(currentFrame);

    if (this.lastBlockEnd !== null && blockStart !== this.lastBlockEnd) {
      this.frameDiscontinuities += 1;
    }

    for (let channel = 0; channel < output.length; channel += 1) {
      const samples = output[channel];
      for (let i = 0; i < samples.length; i += 1) {
        const absoluteFrame = blockStart + i;
        samples[i] = this.signalRunning
          ? Math.sin((2 * Math.PI * this.frequencyHz * absoluteFrame) / sampleRate) * this.gain
          : 0;
      }
    }

    this.processCalls += 1;
    this.processedFrames += frameCount;
    this.lastRenderQuantum = frameCount;
    this.lastBlockEnd = blockStart + frameCount;
    return true;
  }
}

registerProcessor('libertas-kernel', LibertasKernelProcessor);
