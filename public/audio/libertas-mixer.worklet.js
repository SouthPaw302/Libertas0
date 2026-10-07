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
      {
        name: 'crossfader',
        defaultValue: 0,
        minValue: -1,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'limiterThreshold',
        defaultValue: 0.98,
        minValue: 0.5,
        maxValue: 1,
        automationRate: 'k-rate',
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
    this.lastCrossfader = 0;
    this.crossfaderGainA = Math.SQRT1_2;
    this.crossfaderGainB = Math.SQRT1_2;
    this.inputAPeak = 0;
    this.inputBPeak = 0;
    this.samplerInputPeak = 0;
    this.summedPeakBeforeClamp = 0;
    this.outputPeak = 0;
    this.clippedSamples = 0;
    this.limitedSamples = 0;
    this.hardClippedSamplesAfterLimiter = 0;
    this.limiterThreshold = 0.98;
    this.limiterGain = 1;
    this.limiterGainReductionDb = 0;
    this.maxLimiterGainReductionDb = 0;
    this.limiterReleaseSeconds = 0.08;

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
      crossfader: this.lastCrossfader,
      crossfaderGainA: this.crossfaderGainA,
      crossfaderGainB: this.crossfaderGainB,
      inputAPeak: this.inputAPeak,
      inputBPeak: this.inputBPeak,
      samplerInputPeak: this.samplerInputPeak,
      summedPeakBeforeClamp: this.summedPeakBeforeClamp,
      outputPeak: this.outputPeak,
      clippedSamples: this.clippedSamples,
      limitedSamples: this.limitedSamples,
      hardClippedSamplesAfterLimiter: this.hardClippedSamplesAfterLimiter,
      limiterThreshold: this.limiterThreshold,
      limiterGain: this.limiterGain,
      limiterGainReductionDb: this.limiterGainReductionDb,
      maxLimiterGainReductionDb: this.maxLimiterGainReductionDb,
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
    const inputSampler = inputs[2] || [];
    const masterVolumes = parameters.masterVolume || [1];
    const crossfaders = parameters.crossfader || [0];
    const limiterThresholds = parameters.limiterThreshold || [0.98];
    const releaseAlpha = 1 - Math.exp(-1 / (sampleRate * this.limiterReleaseSeconds));

    let inputAPeak = 0;
    let inputBPeak = 0;
    let samplerInputPeak = 0;
    let summedPeak = 0;
    let outputPeak = 0;

    for (let i = 0; i < frameCount; i += 1) {
      const master = Number(masterVolumes.length === 1 ? masterVolumes[0] : masterVolumes[i]);
      const crossfader = Number(crossfaders.length === 1 ? crossfaders[0] : crossfaders[i]);
      const threshold = Number(limiterThresholds[0] ?? 0.98);
      this.lastMasterVolume = master;
      this.lastCrossfader = crossfader;
      this.limiterThreshold = threshold;

      const angle = ((crossfader + 1) * Math.PI) / 4;
      const gainA = Math.cos(angle);
      const gainB = Math.sin(angle);
      this.crossfaderGainA = gainA;
      this.crossfaderGainB = gainB;

      for (let channel = 0; channel < output.length; channel += 1) {
        const aChannel = inputA[channel] || inputA[0];
        const bChannel = inputB[channel] || inputB[0];
        const samplerChannel = inputSampler[channel] || inputSampler[0];
        const a = aChannel ? aChannel[i] || 0 : 0;
        const b = bChannel ? bChannel[i] || 0 : 0;
        const sampler = samplerChannel ? samplerChannel[i] || 0 : 0;
        const summed = (a * gainA + b * gainB + sampler) * master;

        inputAPeak = Math.max(inputAPeak, Math.abs(a));
        inputBPeak = Math.max(inputBPeak, Math.abs(b));
        samplerInputPeak = Math.max(samplerInputPeak, Math.abs(sampler));
        summedPeak = Math.max(summedPeak, Math.abs(summed));

        if (Math.abs(summed) > 1) this.clippedSamples += 1;

        const peak = Math.abs(summed);
        const requestedGain = peak > threshold && peak > 0 ? threshold / peak : 1;

        if (requestedGain < this.limiterGain) {
          this.limiterGain = requestedGain;
        } else {
          this.limiterGain += (1 - this.limiterGain) * releaseAlpha;
        }

        if (this.limiterGain < 0.999999) this.limitedSamples += 1;

        const limited = summed * this.limiterGain;
        if (Math.abs(limited) > 1) this.hardClippedSamplesAfterLimiter += 1;
        const safe = Math.max(-1, Math.min(1, limited));

        if (output[channel]) output[channel][i] = safe;
        outputPeak = Math.max(outputPeak, Math.abs(safe));
      }
    }

    this.limiterGainReductionDb =
      this.limiterGain > 0 ? Math.max(0, -20 * Math.log10(this.limiterGain)) : 120;
    this.maxLimiterGainReductionDb = Math.max(
      this.maxLimiterGainReductionDb,
      this.limiterGainReductionDb,
    );
    this.inputAPeak = inputAPeak;
    this.inputBPeak = inputBPeak;
    this.samplerInputPeak = samplerInputPeak;
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
