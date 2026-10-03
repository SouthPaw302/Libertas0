# Libertas0 Soul

Libertas0 is a professional modular music-performance system and a governed development environment.

## Mission
Build the instrument first: Deck A + Deck B + independent volume + stable simultaneous playback + precise synchronization under active performance use.

## Invariants
- Realtime musical execution is deterministic.
- UI, agents, models, network, storage, and background workers never own the realtime musical clock.
- Human action outranks automation.
- A module is complete only when its required proof gate is satisfied.
- No silent fallback: requested provider, selected provider, reason, and evidence are recorded.
- No fake controls: a visible control works, clearly reports unavailable, or is absent.
- GitHub is durable project authority; chat is working context.
- Development is modular: research -> contract -> implementation -> automated proof -> runtime proof -> local proof when required -> promotion.
- Locked lower modules cannot be bypassed to hide defects above them.
- Architectural decisions and failures are preserved as project memory.

## First product truth
A user must be able to load two tracks, play both, independently control their volumes, engage SYNC, and actively manipulate the decks without losing musical control.

Everything above that is secondary until the foundation is proven.
