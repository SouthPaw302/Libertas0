# Local Debug Session Log

## DECK-B-MIXER-T5-001 — 2026-10-03

- Tested exact product SHA: `6d8e472887c72c9ffe5e80600791edd939a214e9`
- Task definition commit: `db1c7485237fd1550891b569a652645eb06cd624`
- Bootstrap: PASS
- Automated gate: `npm run check` PASS — typecheck, 7 unit tests, production build
- Browser: Codex in-app browser, headed Chromium
- Physical endpoint: `Speakers / Headphones (Realtek Audio)`
- Runtime: 48,000 Hz, 128-frame quantum, base latency 10 ms, output latency 48 ms

### Dual local audio

- Deck A: `Tribal House  (Remastered).wav`, stereo, 48 kHz, 305 seconds.
- Deck B: `Tribal House  (Remastered) (1).wav`, stereo, 48 kHz, 305 seconds.
- Both local files loaded and played through the in-app browser.

### Deck independence and mixer controls

- Pausing either deck left the other deck playing.
- Seek controls independently reached Deck A 50% and Deck B 70% positions.
- Independent deck volume-to-zero and restore passed; master 0 muted output and master 1 restored it.
- Deck A 0.5x and Deck B 1.5x varispeed controls exercised.
- 40 mixed transport/control operations completed.

### Continuous playback

- Duration: 300 seconds.
- Mixer output frame delta: 14,776,832.
- Deck A, Deck B, and mixer new frame discontinuities: 0.
- Final context state: running; both decks loaded and playing.

### Physical listening

- User heard the local audio through the physical output; no clicks or dropouts were reported.
- Final result: `PASS`.
