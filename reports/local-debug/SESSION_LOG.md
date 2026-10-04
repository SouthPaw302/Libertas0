# Local Debug Session Log

## SYNC-T5-001 — 2026-10-04

- Tested exact product SHA: `76f3c2e75538a5a89af25316508a9fef8e176ea1`
- Handoff commit: `52a9602717fe5d6bcf03db3dcde83780b10d4ecc`
- Bootstrap: PASS
- Automated gate: `npm run check` PASS — typecheck, 20 unit tests, production build
- Browser: Codex in-app browser, headed Chromium
- Physical endpoint: `Speakers / Headphones (Realtek Audio)`
- Runtime: 48,000 Hz, 128-frame quantum, base latency 10 ms, output latency 40 ms

### Generated convergence

- Loaded generated click pair A=120 BPM and B=128 BPM.
- Offset B, played both, enabled `SYNC B to A`.
- Stable lock: `syncLocked=true`, phase error `0.0053085` beats, follower rate `0.9410105`, and B seek count unchanged at `1`.

### Leader-rate follow

- Changed leader A to 1.05x.
- Follower settled at `0.984374955` versus expected `0.984375`.
- Phase error `0.0001427` beats; lock remained true; no new discontinuities or seek.

### Main-thread stress

- Blocked the browser main thread for 600 ms while locked.
- Output advanced 54,272 frames; follower source advanced 57,890.13 frames.
- A/B/mixer new frame discontinuities: 0.
- Reverse-lock stress also passed with phase error `0.0009401` beats and no seek increase.

### Five-minute hold

- Held the generated pair locked for 300 seconds in the tiny browser.
- Stable final sample before natural track end: phase error `0.0001427` beats, lock true, A/B discontinuities 0, follower seek count 1.
- Both tracks remained responsive through the hold; they then reached their natural end.

### Reverse leadership

- Disabled SYNC, offset A, then enabled `SYNC A to B`.
- B became leader and A follower; stable phase error `0.0050161` beats, follower rate `1.0702049`, and no post-engagement seek.

### Ordinary tracks and listening

- Ordinary tracks: `NOT_EVALUATED`; no verified BPM/first-beat grids were supplied.
- User confirmed the generated click pair was playing in the tiny browser; no clicks/dropouts were reported.
- Final result: `PASS`.
