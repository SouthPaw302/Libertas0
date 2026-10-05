# Waveform / Track View Contract

## Module

Module 13 — `waveform-track-view`.

## Goal

Give each deck a useful DJ track display without moving any realtime authority into the UI.

Each deck exposes:
- full-track overview waveform;
- scrolling/detail waveform centered around the current source frame;
- transport playhead;
- Musical Clock beat and bar grid;
- Cue marker;
- Hot Cue markers;
- active loop range and loop boundaries.

## Data path

At PCM load time, before channel buffers are transferred to the deck AudioWorklet, Libertas computes a compact deterministic min/max peak envelope.

The view then reads:
- cached waveform envelope;
- deck `sourceFrame`, duration/sample-rate, cue/hotcue/loop status;
- current Musical Clock grid.

The waveform never decodes audio again and never reads timing from wall clock for musical position.

## Authority boundary

Canvas rendering, `requestAnimationFrame`, browser layout, and the cached waveform envelope are presentation only.

They may not:
- write or derive the authoritative deck `sourceFrame`;
- seek a deck;
- change playback rate;
- own Musical Clock phase;
- own SYNC correction;
- execute cue/hotcue/loop events;
- feed timing corrections back to any realtime module.

The only authoritative playhead position is the source frame reported by the proven deck AudioWorklet.

## Overview

The overview maps frame 0 through `sourceFrames` across the full canvas and draws the current playhead plus transport markers.

## Detail view

The detail view displays a bounded 12-second frame window centered around the source frame when possible and clamped at track boundaries.

Beat and bar lines are derived from:
- BPM;
- first beat frame;
- source sample rate;
- beats per bar.

## Required gates

- unit: envelope generation, frame/window mapping, beat-line derivation, marker extraction;
- integration: loading PCM creates waveform data and rendering does not alter transport counters;
- runtime: both deck canvases render and reflect live deck/Musical Clock/performance state in Chromium.

## Non-goals

- waveform-driven seeking or scratching;
- spectral/RGB waveform analysis;
- phrase/structure coloring;
- variable-tempo warp visualization;
- GPU-accelerated rendering;
- UI timing authority.
