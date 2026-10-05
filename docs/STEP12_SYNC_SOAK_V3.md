# Step 12 — SYNC Soak v3 Closeout

## Result

**Technical PASS.**

Product/runtime SHA tested: `93d6c5b83549e598cc8718e830cb7effbf35eb0d`.

The new SYNC module passed both hosted torture and a 620-second real-WAV browser run.

## Hosted proof

- 180-second disturbance hold PASS.
- Maximum phase error: 0.000943 beats.
- Hidden maintenance seeks: 0.
- Frame discontinuities: 0.
- Three explicit follower performance jumps recovered.
- 24 enable/disable + alternating-leadership cycles PASS.

## Real-WAV browser proof

Files:
- Midnight Tribal Pulse (Remastered).wav — SHA-256 `742CBE8E1B9740AA29856D5D503E5D8436285DEECAB2803FCCE3274BF199635F`.
- Tribal House (Remastered).wav — SHA-256 `639634136FE1630941F391B7667C7CD5CD0855D95651BF1ED77971618854FE1D`.

Track Intelligence proposed and explicitly applied both grids.

The 620-second hold included leader rate changes, follower Hot Cue, follower jogs, a four-beat loop, leadership reversal, and a second leader-rate change after reversal.

Final state:
- leader B / follower A;
- follower tracking + locked;
- final phase error about 0.000941 beats;
- hidden seeks A/B: 0/0;
- frame discontinuities A/B: 0/0;
- console errors: 0.

## Recording analysis

Drive recording ID: `13_TtmO0wnsg91hD6orl6ftpQPl3rSCAQ`.

Independent decode/analysis:
- 48 kHz stereo Opus/WebM;
- 10,033,238 bytes;
- encoded packet span about 620.457 seconds;
- mean level about -17.5 dB;
- peak about -2.9 dBFS;
- integrated loudness about -16.5 LUFS;
- LRA about 1.9 LU;
- no >=100 ms silence/dropout events below -50 dBFS.

The recorder stop result reported 622.52 seconds. The encoded file itself contains about 620.46 seconds of audio. This does not affect the SYNC continuity result.

A separate telemetry defect was discovered: querying recording status long after stop kept increasing `durationSeconds`. The closeout includes a narrow fix that freezes completed duration once MediaRecorder stops, plus a browser regression test.

## Audible status

`NOT_EVALUATED`.

No human speaker-listening claim is inferred from the automated browser run. Machine-verifiable SYNC continuity is PASS; subjective listening remains a residual physical judgment if desired later.
