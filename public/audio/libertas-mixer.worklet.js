class LibertasMixerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'masterVolume',
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
    ];
  }

  constructor() {
    super();
    this.processCalls = 0;
    this.processedOutputFrames = 0;
    this.frameDiscontinuities = 0;
    this.lastBlockEnd = null;
    this.lastRenderQuantum = 0;
    this.lastMasterVolume = 1;
    this.inputAPeak = 0;
    this.inputBPeak = 0;
    this.summedPeakBeforeClamp = 0;
    this.outputPeak = 0;
    this.clippedSamples = 0;

    this.port.onmessage = (event) => {
      const message = event.data || {};
      const requestId = Number(message.requestId);
      if (message.type !== 'status' || !Number.isInteger(requestId)) return;
      this.respond(requestId);
    };
  }

  respond(requestId) {
    this.port.postMessage({
      type: 'response',
      requestId,
      ok: true,
      outputCurrentFrame: Number(currentFrame),
      sampleRate: Number(sampleRate),
      renderQuantum: this.lastRenderQuantum,
      processCalls: this.processCalls,
      processedOutputFrames: this.processedOutputFrames,
      frameDiscontinuities: this.frameDiscontinuities,
      masterVolume: this.lastMasterVolume,
      inputAPeak: this.inputAPeak,
      inputBPeak: this.inputBPeak,
      summedPeakBeforeClamp: this.summedPeakBeforeClamp,
      outputPeak: this.outputPeak,
      clippedSamples: this.clippedSamples,
    });
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0] || [];
    const frameCount = output[0]?.length ?? 0;
    const blockStart = Number(currentFrame);

    if (this.lastBlockEnd !== null && blockStart !== this.lastBlockEnd) {
      this.frameDiscontinuities += 1;
    }

    const inputA = inputs[0] || [];
    const inputB = inputs[1] || [];
    const masterVolumes = parameters.masterVolume || [1];

    let inputAPeak = 0;
    let inputBPeak = 0;
    let summedPeak = 0;
    let outputPeak = 0;

    for (let i = 0; i < frameCount; i += 1) {
      const master = masterVolumes.length === 1 ? masterVolumes[0] : masterVolumes[i];
      this.lastMasterVolume = Number(master);

      for (let channel = 0; channel < output.length; channel += 1) {
        const aChannel = inputA[channel] || inputA[0];
        const bChannel = inputB[channel] || inputB[0];
        const a = aChannel ? aChannel[i] || 0 : 0;
        const b = bChannel ? bChannel[i] || 0 : 0;
        const summed = (a + b) * master;

        inputAPeak = Math.max(inputAPeak, Math.abs(a));
        inputBPeak = Math.max(inputBPeak, Math.abs(b));
        summedPeak = Math.max(summedPeak, Math.abs(summed));

        if (Math.abs(summed) > 1) this.clippedSamples += 1;
        const safe = Math.max(-1, Math.min(1, summed));
        if (output[channel]) output[channel][i] = safe;
        outputPeak = Math.max(outputPeak, Math.abs(safe));
      }
    }

    this.inputAPeak = inputAPeak;
    this.inputBPeak = inputBPeak;
    this.summedPeakBeforeClamp = summedPeak;
    this.outputPeak = outputPeak;
    this.processCalls += 1;
    this.processedOutputFrames += frameCount;
    this.lastRenderQuantum = frameCount;
    this.lastBlockEnd = blockStart + frameCount;
    return true;
  }
}

registerProcessor('libertas-mixer', LibertasMixerProcessor);
