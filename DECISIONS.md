# Libertas0 Decision Log

## D-0001 — Development OS before product code
Status: ACCEPTED

Every future session must recover exact project truth without reconstructing it from chat history.

## D-0002 — GitHub runner-backed debug bus is the canonical local-agent bridge
Status: ACCEPTED

The local debug agent receives exact SHAs/test requests through GitHub issue #1 and returns durable evidence through `validation/local-debug`.

## D-0003 — Technology is capability-selected, not inherited
Status: ACCEPTED

Previous implementations are reference/candidate material. Nothing becomes canonical merely because it already exists.

## D-0004 — Realtime musical authority is deterministic
Status: ACCEPTED

UI, agents, inference, network, storage, CI, and browser UI timers may request actions but never own realtime musical execution.
