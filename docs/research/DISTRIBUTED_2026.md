# Distributed Libertas — 2026 Research Note

## Project scope

The final Libertas0 phase is not "put the DJ engine on the network." It is a distributed control/execution layer around the proven local instrument.

Target capabilities:
- remote control nodes;
- shared sessions and role authority;
- capability negotiation;
- distributed analysis workers;
- collaborative agents;
- remote rendering/reconstruction jobs;
- external execution nodes;
- later distributed library/storage providers.

The locked local AudioWorklet/Deck/Musical Clock/SYNC path remains authoritative.

## Browser transport choice

Reference transport: WebRTC `RTCDataChannel`.

Current MDN documentation describes RTCDataChannel as a bidirectional peer-to-peer arbitrary-data channel associated with RTCPeerConnection. Ordered delivery is supported and defaults to true; Libertas requests `ordered: true` explicitly for control/state messages.

WebRTC data-channel traffic is encrypted with DTLS. This is transport encryption, not application-level identity/authentication; Phase 11 must still define rendezvous and trust policy before production WAN use.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel
- https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/ordered
- https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels
- https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel

## Why BroadcastChannel is not the distributed transport

BroadcastChannel is useful for same-origin tabs/workers and development coordination, but it is constrained to compatible same-origin/storage-partition contexts. It does not solve cross-device peer transport.

Reference:
- https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel

## Message model

Libertas uses versioned JSON envelopes in the first reference implementation because they are:
- inspectable;
- deterministic to validate;
- easy to retain as evidence;
- provider-independent.

The protocol caps message size and requires monotonic sender sequence numbers. Binary/artifact payloads should move through content-addressed storage or a future chunk/file transport instead of inflating control messages.

## Authority model

The network carries intent, not musical time.

Forbidden network-owned state includes:
- sourceFrame;
- render/current audio frame;
- Musical Clock;
- SYNC correction/target rate;
- phase correction/snapshots.

Remote UI or agent action must be translated into the same explicit control operations already used locally.

## Work distribution

Remote analysis/render/reconstruction/agent tasks use content/artifact references. This allows the future worker provider to be:
- another browser;
- a desktop process;
- a GitHub runner;
- a cloud worker;
- an accelerator-backed node.

The worker result is an artifact + metrics, not a competing realtime clock.

## Phase 11 staged gates

### Slice A — distributed core
- versioned protocol;
- capability negotiation;
- host role authority;
- replay/stale rejection;
- memory transport simulation;
- ordered WebRTC DataChannel runtime;
- remote control into real mixer;
- remote analysis-job reference roundtrip;
- locked-core regression under a 600 ms UI stall.

### Slice B — rendezvous and resilience
- session identity/trust;
- reconnect;
- disconnect/partition handling;
- stale-role revocation;
- delayed/duplicate/reordered-message torture;
- bounded queue/backpressure behavior;
- explicit NAT/TURN disposition.

### Slice C — worker/session torture
- multiple workers;
- capability mismatch;
- job cancellation/timeouts;
- worker loss/retry policy;
- distributed artifact integrity;
- prolonged session hold while local decks remain stable.

Phase 11 is not LOCKED until its declared integration/runtime gates pass and the remaining production limitations are recorded honestly.
