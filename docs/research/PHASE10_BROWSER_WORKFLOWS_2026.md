# Phase 10 Browser Workflow Research — October 2026

## Library
IndexedDB is used as the browser-local persistence provider because Phase 10 needs durable binary audio plus structured metadata without creating a server dependency.

## MIDI
Web MIDI remains a limited-availability API and requires a secure context plus explicit permission. The deterministic mapping engine is therefore separated from the browser permission/device adapter.

Reference:
https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API

## Recording
Web Audio provides MediaStreamAudioDestinationNode as an output tap. Its MediaStream can be consumed by MediaRecorder. This allows recording the post-mixer audio graph without inserting a recorder into realtime output authority.

References:
https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination
https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder

## Automation
AudioParam timeline methods schedule parameter values against AudioContext time and execute inside the audio rendering system. Phase 10 schedules continuous mixer/channel automation before execution rather than driving it from repeated JavaScript timer callbacks.

References:
https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setValueAtTime
https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime
