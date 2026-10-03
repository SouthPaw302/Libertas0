# Local Debug Reports

This directory is the only writable scope for the `validation/local-debug` branch.

The local debug agent writes:
- `LATEST.json` — latest structured result;
- `ENVIRONMENT.json` — local machine/runtime capability snapshot;
- `SESSION_LOG.md` — concise run history;
- `artifacts/` — small durable evidence.

Large evidence may be Action artifacts referenced from `LATEST.json`.

The report branch must not patch product/system code.
