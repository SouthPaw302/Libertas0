const SYNC_HEADER_BYTES = 8;
const SYNC_DATA_LENGTH = 7;
const SYNC_OUTPUT_FRAME = 0;
const SYNC_SOURCE_FRAME = 1;
const SYNC_EFFECTIVE_RATE = 2;
const SYNC_SOURCE_SAMPLE_RATE = 3;
const SYNC_BPM = 4;
const SYNC_FIRST_BEAT_FRAME = 5;
const SYNC_PLAYING = 6;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function wrapBeatError(error) {
  return ((error + 0.5) % 1 + 1) % 1 - 0.5;
}

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
    this.transportSeekCount = 0;
    this.lastBlockEnd = null;
    this.lastRenderQuantum = 0;
    this.lastVolume = 1;
    this.lastManualPlaybackRate = 1;
    this.lastPlaybackRate = 1;
    this.outputPeak = 0;

    this.cueFrame = null;
    this.hotCues = Array(8).fill(null);
    this.loopEnabled = false;
    this.loopStartFrame = null;
    this.loopEndFrame = null;
    this.loopWrapCount = 0;
    this.performanceJumpCount = 0;
    this.cueTriggerCount = 0;
    this.hotCueTriggerCount = 0;
    this.jogCount = 0;

    this.syncRole = 'off';
    this.syncSeq = null;
    this.syncData = null;
    this.syncLeaderGrid = null;
    this.syncFollowerGrid = null;
    this.syncOptions = null;
    this.syncRate = 1;
    this.syncTracking = false;
    this.syncLocked = false;
    this.syncPhaseErrorBeats = null;
    this.syncTempoMatchedRate = null;
    this.syncCorrectionRate = null;
    this.syncTargetRate = null;
    this.syncSnapshotAgeFrames = null;
    this.syncValidSnapshots = 0;
    this.syncStaleSnapshots = 0;

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
            if (!this.sourceFrames) throw new Error('Deck has no loaded PCM');
            if (this.sourceFrame >= this.sourceFrames) this.sourceFrame = 0;
            this.playing = true;
            this.ended = false;
            break;
          case 'pause':
            this.playing = false;
            break;
          case 'seek':
            if (!this.sourceFrames) throw new Error('Deck has no loaded PCM');
            if (!Number.isFinite(message.frame)) throw new Error('seek frame must be finite');
            this.sourceFrame = Math.min(Math.max(Number(message.frame), 0), this.sourceFrames);
            this.ended = this.sourceFrame >= this.sourceFrames;
            this.transportSeekCount += 1;
            break;
          case 'mute':
            this.muted = Boolean(message.muted);
            break;
          case 'cue-set':
            this.requireLoaded();
            this.cueFrame = this.clampSourceFrame(Number(message.frame));
            break;
          case 'cue-set-current':
            this.requireLoaded();
            this.cueFrame = this.clampSourceFrame(this.sourceFrame);
            break;
          case 'cue-trigger':
            this.requireLoaded();
            if (this.cueFrame === null) throw new Error('Cue is not set');
            this.sourceFrame = this.cueFrame;
            this.ended = false;
            this.playing = message.pause === false ? this.playing : false;
            this.performanceJumpCount += 1;
            this.cueTriggerCount += 1;
            break;
          case 'hotcue-set':
            this.requireLoaded();
            this.setHotCue(Number(message.slot), Number(message.frame));
            break;
          case 'hotcue-set-current':
            this.requireLoaded();
            this.setHotCue(Number(message.slot), this.sourceFrame);
            break;
          case 'hotcue-clear':
            this.clearHotCue(Number(message.slot));
            break;
          case 'hotcue-trigger':
            this.requireLoaded();
            this.triggerHotCue(Number(message.slot));
            break;
          case 'loop-set':
            this.requireLoaded();
            this.configureLoop(Number(message.startFrame), Number(message.endFrame), Boolean(message.enabled));
            break;
          case 'loop-enable':
            if (Boolean(message.enabled) && (this.loopStartFrame === null || this.loopEndFrame === null)) {
              throw new Error('Loop boundaries are not set');
            }
            this.loopEnabled = Boolean(message.enabled);
            break;
          case 'loop-clear':
            this.loopEnabled = false;
            this.loopStartFrame = null;
            this.loopEndFrame = null;
            break;
          case 'jog':
            this.requireLoaded();
            if (!Number.isFinite(message.deltaFrames)) throw new Error('jog delta must be finite');
            this.sourceFrame = this.clampSourceFrame(this.sourceFrame + Number(message.deltaFrames));
            this.ended = this.sourceFrame >= this.sourceFrames;
            this.performanceJumpCount += 1;
            this.jogCount += 1;
            break;
          case 'sync-configure':
            this.configureSync(message);
            break;
          case 'sync-disable':
            this.disableSync();
            break;
          case 'status':
            break;
          default:
            throw new Error(`Unknown deck command: ${String(message.type)}`);
        }

        this.respond(requestId, true);
      } catch (error) {
        this.respond(requestId, false, error instanceof Error ? error.message : String(error));
      }
    };
  }

  load(message) {
    if (!Array.isArray(message.channelBuffers)) {
      throw new Error('Deck load requires channelBuffers');
    }
    if (message.channelBuffers.length !== 1 && message.channelBuffers.length !== 2) {
      throw new Error('Deck v1 accepts one or two PCM channels');
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
    this.transportSeekCount = 0;
    this.cueFrame = null;
    this.hotCues = Array(8).fill(null);
    this.loopEnabled = false;
    this.loopStartFrame = null;
    this.loopEndFrame = null;
    this.loopWrapCount = 0;
    this.performanceJumpCount = 0;
    this.cueTriggerCount = 0;
    this.hotCueTriggerCount = 0;
    this.jogCount = 0;
    this.disableSync();
  }

  requireLoaded() {
    if (!this.sourceFrames) throw new Error('Deck has no loaded PCM');
  }

  clampSourceFrame(frame) {
    if (!Number.isFinite(frame)) throw new Error('source frame must be finite');
    return Math.min(Math.max(frame, 0), this.sourceFrames);
  }

  validateHotCueSlot(slot) {
    if (!Number.isInteger(slot) || slot < 1 || slot > 8) {
      throw new Error('hot cue slot must be an integer from 1 to 8');
    }
    return slot - 1;
  }

  setHotCue(slot, frame) {
    const index = this.validateHotCueSlot(slot);
    this.hotCues[index] = this.clampSourceFrame(frame);
  }

  clearHotCue(slot) {
    const index = this.validateHotCueSlot(slot);
    this.hotCues[index] = null;
  }

  triggerHotCue(slot) {
    const index = this.validateHotCueSlot(slot);
    const frame = this.hotCues[index];
    if (frame === null) throw new Error(`Hot cue ${slot} is not set`);
    this.sourceFrame = frame;
    this.ended = false;
    this.performanceJumpCount += 1;
    this.hotCueTriggerCount += 1;
  }

  configureLoop(startFrame, endFrame, enabled) {
    const start = this.clampSourceFrame(startFrame);
    const end = this.clampSourceFrame(endFrame);
    if (!(end > start)) throw new Error('loop end must be greater than loop start');
    this.loopStartFrame = start;
    this.loopEndFrame = end;
    this.loopEnabled = enabled;
    if (this.loopEnabled && (this.sourceFrame < start || this.sourceFrame >= end)) {
      this.sourceFrame = start;
      this.performanceJumpCount += 1;
    }
  }

  wrapLoopPosition(frame) {
    if (!this.loopEnabled || this.loopStartFrame === null || this.loopEndFrame === null) {
      return frame;
    }
    const length = this.loopEndFrame - this.loopStartFrame;
    if (length <= 0 || frame < this.loopEndFrame) return frame;
    const overshoot = frame - this.loopStartFrame;
    const wrapped = this.loopStartFrame + (overshoot % length);
    this.loopWrapCount += Math.max(1, Math.floor(overshoot / length));
    return wrapped;
  }

  configureSync(message) {
    if (!(message.sharedBuffer instanceof SharedArrayBuffer)) {
      throw new Error('SYNC requires SharedArrayBuffer');
    }
    const role = String(message.role);
    if (role !== 'leader' && role !== 'follower') {
      throw new Error('SYNC role must be leader or follower');
    }

    this.syncSeq = new Int32Array(message.sharedBuffer, 0, 1);
    this.syncData = new Float64Array(message.sharedBuffer, SYNC_HEADER_BYTES, SYNC_DATA_LENGTH);
    this.syncRole = role;
    this.syncTracking = false;
    this.syncLocked = false;
    this.syncPhaseErrorBeats = null;
    this.syncTempoMatchedRate = null;
    this.syncCorrectionRate = null;
    this.syncTargetRate = null;
    this.syncSnapshotAgeFrames = null;
    this.syncValidSnapshots = 0;
    this.syncStaleSnapshots = 0;

    if (role === 'leader') {
      this.syncLeaderGrid = this.validateSyncGrid(message.grid);
      this.syncFollowerGrid = null;
      this.syncOptions = null;
      return;
    }

    this.syncLeaderGrid = this.validateSyncGrid(message.leaderGrid);
    this.syncFollowerGrid = this.validateSyncGrid(message.followerGrid);
    const options = message.options || {};
    this.syncOptions = {
      phaseSettleSeconds: this.positiveFinite(options.phaseSettleSeconds, 'phaseSettleSeconds'),
      maxPhaseCorrectionRate: this.positiveFinite(options.maxPhaseCorrectionRate, 'maxPhaseCorrectionRate'),
      phaseDeadbandBeats: this.nonNegativeFinite(options.phaseDeadbandBeats, 'phaseDeadbandBeats'),
      rateSmoothingSeconds: this.positiveFinite(options.rateSmoothingSeconds, 'rateSmoothingSeconds'),
      lockThresholdBeats: this.nonNegativeFinite(options.lockThresholdBeats, 'lockThresholdBeats'),
      staleSnapshotSeconds: this.positiveFinite(options.staleSnapshotSeconds, 'staleSnapshotSeconds'),
    };
    this.syncRate = this.lastPlaybackRate;
  }

  validateSyncGrid(grid) {
    const bpm = Number(grid?.bpm);
    const firstBeatFrame = Number(grid?.firstBeatFrame);
    if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('SYNC grid bpm must be positive');
    if (!Number.isFinite(firstBeatFrame)) throw new Error('SYNC firstBeatFrame must be finite');
    return { bpm, firstBeatFrame };
  }

  positiveFinite(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be positive`);
    return n;
  }

  nonNegativeFinite(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be non-negative`);
    return n;
  }

  disableSync() {
    this.syncRole = 'off';
    this.syncSeq = null;
    this.syncData = null;
    this.syncLeaderGrid = null;
    this.syncFollowerGrid = null;
    this.syncOptions = null;
    this.syncTracking = false;
    this.syncLocked = false;
    this.syncPhaseErrorBeats = null;
    this.syncTempoMatchedRate = null;
    this.syncCorrectionRate = null;
    this.syncTargetRate = null;
    this.syncSnapshotAgeFrames = null;
  }

  publishLeaderSnapshot(blockStart, effectiveRate) {
    if (this.syncRole !== 'leader' || !this.syncSeq || !this.syncData || !this.syncLeaderGrid) return;

    Atomics.add(this.syncSeq, 0, 1);
    this.syncData[SYNC_OUTPUT_FRAME] = blockStart;
    this.syncData[SYNC_SOURCE_FRAME] = this.sourceFrame;
    this.syncData[SYNC_EFFECTIVE_RATE] = effectiveRate;
    this.syncData[SYNC_SOURCE_SAMPLE_RATE] = this.sourceSampleRate;
    this.syncData[SYNC_BPM] = this.syncLeaderGrid.bpm;
    this.syncData[SYNC_FIRST_BEAT_FRAME] = this.syncLeaderGrid.firstBeatFrame;
    this.syncData[SYNC_PLAYING] = this.playing ? 1 : 0;
    Atomics.add(this.syncSeq, 0, 1);
  }

  readLeaderSnapshot() {
    if (!this.syncSeq || !this.syncData) return null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const before = Atomics.load(this.syncSeq, 0);
      if (before & 1) continue;

      const snapshot = {
        outputFrame: this.syncData[SYNC_OUTPUT_FRAME],
        sourceFrame: this.syncData[SYNC_SOURCE_FRAME],
        effectiveRate: this.syncData[SYNC_EFFECTIVE_RATE],
        sourceSampleRate: this.syncData[SYNC_SOURCE_SAMPLE_RATE],
        bpm: this.syncData[SYNC_BPM],
        firstBeatFrame: this.syncData[SYNC_FIRST_BEAT_FRAME],
        playing: this.syncData[SYNC_PLAYING] === 1,
      };

      const after = Atomics.load(this.syncSeq, 0);
      if (before === after && !(after & 1)) return snapshot;
    }

    return null;
  }

  updateFollowerSync(blockStart, manualRate) {
    if (
      this.syncRole !== 'follower' ||
      !this.syncFollowerGrid ||
      !this.syncOptions ||
      this.sourceSampleRate <= 0
    ) {
      return manualRate;
    }

    const snapshot = this.readLeaderSnapshot();
    if (!snapshot || snapshot.sourceSampleRate <= 0 || snapshot.bpm <= 0) {
      this.syncTracking = false;
      this.syncLocked = false;
      this.syncStaleSnapshots += 1;
      return this.syncRate;
    }

    const ageFrames = blockStart - snapshot.outputFrame;
    this.syncSnapshotAgeFrames = ageFrames;
    const staleLimit = sampleRate * this.syncOptions.staleSnapshotSeconds;
    if (ageFrames < -this.lastRenderQuantum || ageFrames > staleLimit) {
      this.syncTracking = false;
      this.syncLocked = false;
      this.syncStaleSnapshots += 1;
      return this.syncRate;
    }

    this.syncValidSnapshots += 1;
    const projectedLeaderSource =
      snapshot.sourceFrame + Math.max(ageFrames, 0) * snapshot.effectiveRate;
    const leaderFramesPerBeat = (snapshot.sourceSampleRate * 60) / snapshot.bpm;
    const followerFramesPerBeat =
      (this.sourceSampleRate * 60) / this.syncFollowerGrid.bpm;

    const leaderBeatPosition =
      (projectedLeaderSource - snapshot.firstBeatFrame) / leaderFramesPerBeat;
    const followerBeatPosition =
      (this.sourceFrame - this.syncFollowerGrid.firstBeatFrame) / followerFramesPerBeat;
    const phaseError = wrapBeatError(leaderBeatPosition - followerBeatPosition);

    const tempoMatchedRate =
      snapshot.effectiveRate * (snapshot.bpm / this.syncFollowerGrid.bpm);

    let correction = 0;
    if (
      snapshot.playing &&
      this.playing &&
      Math.abs(phaseError) > this.syncOptions.phaseDeadbandBeats
    ) {
      correction =
        (phaseError * 60) /
        (this.syncFollowerGrid.bpm * this.syncOptions.phaseSettleSeconds);
      correction = clamp(
        correction,
        -this.syncOptions.maxPhaseCorrectionRate,
        this.syncOptions.maxPhaseCorrectionRate,
      );
    }

    const targetRate = clamp(tempoMatchedRate + correction, 0.25, 4);
    this.syncTracking = snapshot.playing && this.playing;
    this.syncLocked =
      this.syncTracking && Math.abs(phaseError) <= this.syncOptions.lockThresholdBeats;
    this.syncPhaseErrorBeats = phaseError;
    this.syncTempoMatchedRate = tempoMatchedRate;
    this.syncCorrectionRate = correction;
    this.syncTargetRate = targetRate;
    return targetRate;
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
      manualPlaybackRate: this.lastManualPlaybackRate,
      outputPeak: this.outputPeak,
      transportSeekCount: this.transportSeekCount,
      syncRole: this.syncRole,
      syncEnabled: this.syncRole !== 'off',
      syncTracking: this.syncTracking,
      syncLocked: this.syncLocked,
      syncPhaseErrorBeats: this.syncPhaseErrorBeats,
      syncTempoMatchedRate: this.syncTempoMatchedRate,
      syncCorrectionRate: this.syncCorrectionRate,
      syncTargetRate: this.syncTargetRate,
      syncSnapshotAgeFrames: this.syncSnapshotAgeFrames,
      syncValidSnapshots: this.syncValidSnapshots,
      syncStaleSnapshots: this.syncStaleSnapshots,
      cueFrame: this.cueFrame,
      hotCues: [...this.hotCues],
      loopEnabled: this.loopEnabled,
      loopStartFrame: this.loopStartFrame,
      loopEndFrame: this.loopEndFrame,
      loopWrapCount: this.loopWrapCount,
      performanceJumpCount: this.performanceJumpCount,
      cueTriggerCount: this.cueTriggerCount,
      hotCueTriggerCount: this.hotCueTriggerCount,
      jogCount: this.jogCount,
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
    const manualRate = Number(rates.length === 1 ? rates[0] : rates[0] ?? 1);
    this.lastManualPlaybackRate = manualRate;

    if (this.syncRole === 'leader') {
      this.publishLeaderSnapshot(blockStart, manualRate);
      this.syncTracking = this.playing;
      this.syncLocked = this.playing;
      this.syncTempoMatchedRate = manualRate;
      this.syncCorrectionRate = 0;
      this.syncTargetRate = manualRate;
      this.syncPhaseErrorBeats = 0;
      this.syncSnapshotAgeFrames = 0;
    }

    const followerTarget =
      this.syncRole === 'follower'
        ? this.updateFollowerSync(blockStart, manualRate)
        : manualRate;

    const smoothingSeconds =
      this.syncRole === 'follower' && this.syncOptions
        ? this.syncOptions.rateSmoothingSeconds
        : 0;
    const smoothingAlpha =
      smoothingSeconds > 0
        ? 1 - Math.exp(-1 / (sampleRate * smoothingSeconds))
        : 1;

    if (this.syncRole === 'follower' && !Number.isFinite(this.syncRate)) {
      this.syncRate = manualRate;
    }

    let peak = 0;

    for (let i = 0; i < frameCount; i += 1) {
      const volume = this.muted ? 0 : (volumes.length === 1 ? volumes[0] : volumes[i]);
      const manualSampleRate = Number(rates.length === 1 ? rates[0] : rates[i]);
      let rate = manualSampleRate;

      if (this.syncRole === 'follower') {
        this.syncRate += smoothingAlpha * (followerTarget - this.syncRate);
        rate = clamp(this.syncRate, 0.25, 4);
      }

      this.lastVolume = Number(volume);
      this.lastManualPlaybackRate = manualSampleRate;
      this.lastPlaybackRate = Number(rate);

      let left = 0;
      let right = 0;

      if (this.playing && this.sourceFrames > 0 && this.sourceFrame < this.sourceFrames) {
        left = this.sampleAt(0, this.sourceFrame) * volume;
        right = this.sampleAt(this.sourceChannels > 1 ? 1 : 0, this.sourceFrame) * volume;
        this.sourceFrame += rate;
        this.sourceFrame = this.wrapLoopPosition(this.sourceFrame);

        if (!this.loopEnabled && this.sourceFrame >= this.sourceFrames) {
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
