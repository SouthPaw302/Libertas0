# Mixer / DSP Research — October 2026

## Native Web Audio channel filters
GainNode and BiquadFilterNode execute in the Web Audio rendering graph and expose AudioParams for timeline-scheduled control. They are preferable to reimplementing basic EQ/filter biquads in JavaScript inside the worklet because the browser audio engine already supplies optimized realtime implementations.

Phase 8 uses:
- GainNode for trim;
- lowshelf / peaking / highshelf BiquadFilterNodes for 3-band EQ;
- serial lowpass + highpass BiquadFilterNodes for the bipolar filter.

## Mixer worklet responsibilities
The existing mixer AudioWorklet remains the deterministic two-input summing authority. Phase 8 extends it with:
- equal-power crossfader law;
- master gain;
- sample-peak limiter;
- overload and limiter telemetry;
- final safety clamp.

## Limiter boundary
The limiter observes rendered PCM samples only. It does not oversample, reconstruct inter-sample peaks or claim LUFS/mastering behavior. True-peak and loudness processing remain future DSP work if needed.
