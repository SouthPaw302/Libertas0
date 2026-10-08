# Advanced Library / Preparation Contract

## Module

Module 17 — `advanced-library-preparation`.

## Goal

Turn the existing content-addressed local track library into a real DJ preparation library without moving realtime authority into storage or UI code.

## Track record

The existing SHA-256 content ID and stored audio blob remain authoritative for file identity.

A track may additionally store explicit preparation data:
- title;
- artist;
- album;
- genre;
- key text;
- comment;
- rating 0..5;
- normalized tags;
- Musical Clock beat grid;
- Cue frame;
- up to eight Hot Cue frames;
- loop start/end/enabled state.

Existing v1 track records remain readable.

## Crates

IndexedDB schema version 2 adds a dedicated `crates` store.

Each crate stores:
- id;
- name;
- ordered track-id list;
- creation/update times.

Removing a track also removes stale membership from every crate.

## Search

Search/filter is deterministic and operates on stored track/preparation records.

Supported filters:
- free text across filename/title/artist/album/genre/key/comment/tags;
- crate membership;
- minimum rating;
- required tags;
- prepared-only;
- BPM minimum/maximum.

Search has no realtime role.

## Preparation capture

Capture is explicit.

When the user chooses Capture Prep from Deck A/B, the library reads:
- current persisted editor metadata/rating/tags;
- that deck's current Musical Clock grid;
- Deck AudioWorklet-reported Cue/Hot Cue/loop state.

It then stores those values on the selected library track.

No background or implicit deck-state capture is allowed.

## Prepared load

Loading a prepared library track:
1. loads the stored encoded audio into the chosen deck;
2. explicitly applies the saved Musical Clock grid if present;
3. explicitly restores Cue;
4. explicitly restores Hot Cues;
5. explicitly restores the saved loop range and enabled state.

The library never writes `sourceFrame` directly and never owns transport timing. It only invokes the existing proven Musical Clock and Performance Transport interfaces.

## Authority boundary

IndexedDB, search, crates, metadata and preparation state are persistence/UI concerns.

They may never:
- become a realtime clock;
- schedule deck render frames;
- own SYNC phase/correction;
- write AudioWorklet state except through the existing explicit public control APIs;
- infer hidden preparation changes without user action.

## Required gates

- unit: normalization and deterministic search/filter behavior;
- integration: v1-compatible dedup/import plus v2 crates/preparation;
- runtime: prepared load restores grid/cue/hotcue/loop through real deck APIs;
- capture: deck state is persisted explicitly;
- regression: original Phase 10 library test and locked performance transport remain green.

## Non-goals

- cloud library sync;
- streaming-provider catalog integration;
- automatic semantic genre/key/phrase analysis;
- variable-tempo warp maps;
- database-owned realtime timing;
- background implicit prep mutation.
