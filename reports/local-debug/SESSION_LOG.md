# Local Debug Session Log

## DECK-A-T5-001 — 2026-10-03

- Tested exact product SHA: `6bf34aa6a00004b29be21d847748f09b41081ad1`
- Bootstrap: PASS
- Automated gate: `npm run check` PASS — typecheck, 7 unit tests, production build
- Browser: headed Microsoft Edge 154.0.4258.48
- Physical endpoint: `Speakers / Headphones (Realtek Audio)`
- Runtime: 48,000 Hz, 128-frame quantum, base latency 10 ms, output latency 48 ms

### Generated and ordinary local audio

- Generated WAV: Web Audio decoder, stereo, 48 kHz, 20 seconds, loaded and played.
- Ordinary local WAV: `silver-coin-remastered.wav`, Web Audio decoder, stereo, 48 kHz, 207.44 seconds.

### Transport and controls

- Play advanced to source frame 11,136 after 500 ms.
- Pause held source frame at 11,520 across a 300 ms wait.
- Seek reached frame 72,000 for the 1.5 second target.
- Measured varispeed: 0.5x, 1.0x, 1.5x, 2.0x exactly.
- Volume RMS: 0.354 full, 0 at zero, 0.352 restored.
- Mute RMS: 0.
- Mixed transport/control operations: 30.

### Main-thread stress

- 600 ms stall while playing.
- Output delta: 29,312 frames.
- Source delta: 29,312 frames.
- New discontinuities: 0.

### Continuous playback

- Duration: 300 seconds.
- Output delta: 14,406,784 frames.
- Source delta: 14,406,784 frames.
- New discontinuities: 0.

### Console and physical listening

- Two browser-generated 404 resource errors; no Deck A runtime exception observed.
- User confirmation: PASS — an ordinary local Deck A audio file was loaded and played fine on the physical output.
- Final result: `PASS`.
