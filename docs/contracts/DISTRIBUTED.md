# Distributed Libertas Contract

## Purpose

Phase 11 adds a distributed control and execution plane around the locked Libertas realtime engine.

Distributed services may:
- negotiate node capabilities;
- assign explicit operator roles;
- carry explicit control intents;
- publish advisory state and content-addressed track manifests;
- delegate non-realtime analysis, rendering, reconstruction, and agent work;
- return artifact references and measurements.

Distributed services may **not** own or synthesize realtime musical authority.

## Realtime authority boundary

The local deterministic audio engine remains the sole authority for:
- deck source frame;
- AudioWorklet render frame;
- Musical Clock;
- SYNC phase and correction rate;
- loop wrap timing;
- cue/hotcue/jog execution timing;
- mixer/DSP render timing.

No network packet may directly set, replicate, or correct those clocks.

A remote operator can request an explicit action such as:
- set crossfader;
- play/pause;
- cue/hotcue;
- loop;
- jog;
- load;
- enable/disable SYNC.

The receiving local engine decides when and how the action enters the already-proven local control path.

## Protocol

Protocol: `libertas.distributed.v1`

Envelope fields:
- protocol;
- sessionId;
- senderNodeId;
- monotonically increasing sender sequence;
- sender wall-clock timestamp for observability only;
- message kind;
- payload.

The timestamp is never a scheduling authority.

The first implementation rejects:
- unsupported protocol versions;
- malformed nodes/capabilities/roles;
- duplicate or stale sender sequences;
- messages over the configured size limit;
- explicit control payloads containing realtime-authority fields.

## Session roles

Initial role vocabulary:
- deck-a;
- deck-b;
- mixer;
- fx;
- pads;
- worker;
- observer;
- agent.

The session host is the sole role-grant authority in v1. Role grants are generation-numbered. A remote control intent is accepted only when its sender currently owns the claimed role.

## Capability negotiation

Initial capability vocabulary:
- control;
- library-manifest;
- analysis;
- render;
- reconstruction;
- agent;
- webrtc-datachannel.

Negotiation is the deterministic intersection of declared local/remote capability sets. Missing capability is explicit; there is no silent fallback.

## Remote work

Non-realtime work requests carry:
- job id;
- work kind;
- content/artifact references;
- scalar parameters.

They do not carry hidden filesystem assumptions or realtime clocks.

Initial work kinds:
- analysis;
- render;
- reconstruction;
- agent.

Results return:
- success/failure;
- output artifact references;
- metrics;
- explicit error when applicable.

## Browser transport

The reference browser transport is an ordered `RTCDataChannel` named `libertas-control-v1`.

WebRTC signaling/rendezvous is separate from this transport contract. Phase 11 core does not claim production NAT traversal, TURN availability, short-code/PIN rendezvous, authentication, or WAN resilience until those gates are separately implemented and evidenced.

## Required proof

Phase 11 core must prove:
1. protocol validation and stale/replay rejection;
2. host role authority and unauthorized-control rejection;
3. capability negotiation;
4. remote work result roundtrip by artifact/content reference;
5. actual ordered WebRTC DataChannel runtime in Chromium;
6. a remote mixer command entering the existing local mixer path;
7. active local decks/mixer continue through a 600 ms main-thread stall with zero new discontinuities while the distributed session is active;
8. all locked Phase 2-10 regressions remain green.

## Not proven by the core slice

- production rendezvous/authentication;
- reconnect/partition recovery;
- TURN-backed WAN sessions;
- multi-node worker scheduling;
- distributed file replication;
- remote audio-clock or phase authority (explicitly forbidden);
- production collaborative-agent policy;
- production remote rendering/reconstruction backends.

## Multi-worker routing

The reference worker pool can register multiple execution endpoints and route analysis/render/reconstruction/agent jobs by declared capability. It tracks in-flight work, completion and failure counts. Explicit failure can retry another capable endpoint. Missing capability fails visibly.

This is work distribution only. It does not schedule or correct realtime audio.

