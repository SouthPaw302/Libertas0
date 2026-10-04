import { describe, expect, it } from 'vitest';
import {
  SequenceGate,
  decodeEnvelope,
  encodeEnvelope,
  intersectCapabilities,
} from './DistributedProtocol';
import { DISTRIBUTED_PROTOCOL, type DistributedEnvelope } from './DistributedTypes';

function envelope(kind: DistributedEnvelope['kind'], payload: unknown): DistributedEnvelope {
  return {
    protocol: DISTRIBUTED_PROTOCOL,
    sessionId: 'session-1',
    senderNodeId: 'node-a',
    seq: 1,
    sentAtMs: 123,
    kind,
    payload,
  };
}

describe('DistributedProtocol', () => {
  it('round-trips a valid hello envelope', () => {
    const value = envelope('hello', {
      node: {
        nodeId: 'node-a',
        label: 'Deck laptop',
        capabilities: ['control', 'webrtc-datachannel'],
        requestedRoles: ['deck-a'],
      },
    });
    expect(decodeEnvelope(encodeEnvelope(value))).toEqual(value);
  });

  it('rejects control payloads that attempt to carry realtime musical authority', () => {
    const value = envelope('control-intent', {
      intent: {
        intentId: 'intent-1',
        role: 'mixer',
        target: 'mixer.crossfader',
        action: 'set',
        value: 1,
        parameters: { sourceFrame: 48000 },
      },
    });
    expect(() => encodeEnvelope(value)).toThrow(/realtime musical authority/);
  });

  it('rejects duplicate and out-of-order sender sequences', () => {
    const gate = new SequenceGate();
    expect(gate.accept('peer', 1)).toBe(true);
    expect(gate.accept('peer', 1)).toBe(false);
    expect(gate.accept('peer', 0)).toBe(false);
    expect(gate.accept('peer', 2)).toBe(true);
    expect(gate.last('peer')).toBe(2);
  });

  it('negotiates only shared declared capabilities in canonical order', () => {
    expect(intersectCapabilities(
      ['render', 'control', 'analysis'],
      ['analysis', 'control', 'agent'],
    )).toEqual(['control', 'analysis']);
  });
  it('rejects oversized envelopes before JSON processing can pressure the session', () => {
    const raw = JSON.stringify({ protocol: 'libertas.distributed.v1', padding: 'x'.repeat(1024) });
    expect(() => decodeEnvelope(raw, 128)).toThrow(/size limit/);
  });

});
