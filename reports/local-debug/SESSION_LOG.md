# Local Debug Session Log

## AUDIO-KERNEL-T5-001 — 2026-10-03

- Tested product SHA: `c18f3e80d46aa58d0fbead3a6c7f3bb995b97917`
- Bootstrap: PASS
- Automated gate: `npm run check` PASS — typecheck, 3 unit tests, production build
- Browser: headed Microsoft Edge 154.0.4258.48
- Physical endpoint detected: `Speakers / Headphones (Realtek Audio)`
- Runtime: 48,000 Hz, 128-frame quantum, base latency 10 ms, output latency 41 ms

### Main-thread stall

- Before: frame `58112`, process calls `454`, discontinuities `0`
- After 600 ms stall: frame `88320`, process calls `690`, discontinuities `0`
- Delta: `30208` frames, `0` new discontinuities

### Start/stop cycles

- Completed 10 cycles.
- Final state: `running`; frame `244864`; discontinuities `0`.

### Continuous run

- Duration: 300 seconds, with periodic status refreshes.
- Start frame: `76416`; end frame: `16312832`.
- Advanced frames: `16236416`; discontinuities observed: `0`.

### Console/log notes

- Two browser-generated `Failed to load resource: 404 (Not Found)` entries were observed; no audio-kernel runtime exception was observed.
- Initial immediate status samples can report `renderQuantum=0` before the first worklet quantum; settled samples report `128`.
- User listening confirmation: PASS — user reported the 220 Hz tone was audible and clean on the physical output device.
- Final result: `PASS`.
