import { describe, expect, it } from 'vitest';
import { DistributedSession } from './DistributedSession';
import { MemoryTransport } from './DistributedTransport';
import type { DistributedNode } from './DistributedTypes';

const hostNode: DistributedNode = {
  nodeId: 'host',
  label: 'Host',
  capabilities: ['control', 'analysis', 'webrtc-datachannel'],
  requestedRoles: ['mixer'],
};

const remoteNode: DistributedNode = {
  nodeId: 'remote',
  label: 'Remote',
  capabilities: ['control', 'analysis', 'webrtc-datachannel'],
  requestedRoles: ['mixer', 'worker'],
};

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('DistributedSession', () => {
  it('negotiates peers and authorizes explicit remote control only after a host grant', async () => {
    const [a, b] = MemoryTransport.pair();
    const received: string[] = [];
    const host = new DistributedSession({
      sessionId: 's1',
      hostNodeId: 'host',
      localNode: hostNode,
      transport: a,
      onControlIntent: (intent) => received.push(intent.target),
    });
    const remote = new DistributedSession({
      sessionId: 's1',
      hostNodeId: 'host',
      localNode: remoteNode,
      transport: b,
    });
    host.start();
    remote.start();
    await flush();

    expect(host.status().peers[0]?.node.nodeId).toBe('remote');
    expect(remote.status().peers[0]?.negotiatedCapabilities).toContain('control');

    expect(() => remote.sendControl({
      intentId: 'pre-grant',
      role: 'mixer',
      target: 'mixer.crossfader',
      action: 'set',
      value: 1,
    })).toThrow(/does not own/);

    host.grantRoles('remote', ['mixer']);
    await flush();

    remote.sendControl({
      intentId: 'authorized',
      role: 'mixer',
      target: 'mixer.crossfader',
      action: 'set',
      value: 1,
    });
    await flush();

    expect(received).toEqual(['mixer.crossfader']);
    host.close();
    remote.close();
  });

  it('returns remote analysis results by content reference', async () => {
    const [a, b] = MemoryTransport.pair();
    const host = new DistributedSession({
      sessionId: 's2',
      hostNodeId: 'host',
      localNode: hostNode,
      transport: a,
    });
    const remote = new DistributedSession({
      sessionId: 's2',
      hostNodeId: 'host',
      localNode: remoteNode,
      transport: b,
      workHandlers: {
        analysis: (request) => ({
          ok: true,
          outputRefs: [`analysis:${request.inputRefs[0]}`],
          metrics: { confidence: 0.91 },
        }),
      },
    });
    host.start();
    remote.start();
    await flush();

    const result = await host.requestWork('analysis', ['sha256:abc']);
    expect(result.ok).toBe(true);
    expect(result.outputRefs).toEqual(['analysis:sha256:abc']);
    expect(result.metrics.confidence).toBe(0.91);
    host.close();
    remote.close();
  });

  it('keeps role authority with the configured host', async () => {
    const [a, b] = MemoryTransport.pair();
    const host = new DistributedSession({
      sessionId: 's3',
      hostNodeId: 'host',
      localNode: hostNode,
      transport: a,
    });
    const remote = new DistributedSession({
      sessionId: 's3',
      hostNodeId: 'host',
      localNode: remoteNode,
      transport: b,
    });
    host.start();
    remote.start();
    await flush();
    expect(() => remote.grantRoles('remote', ['mixer'])).toThrow(/only the session host/);
    host.close();
    remote.close();
  });  it('revokes stale role authority on transport loss and requires a fresh host grant after reconnect', async () => {
    const received: string[] = [];
    const [a1, b1] = MemoryTransport.pair();
    const host = new DistributedSession({
      sessionId: 's4',
      hostNodeId: 'host',
      localNode: hostNode,
      transport: a1,
      onControlIntent: (intent) => received.push(intent.intentId),
    });
    const remote = new DistributedSession({
      sessionId: 's4',
      hostNodeId: 'host',
      localNode: remoteNode,
      transport: b1,
    });
    host.start();
    remote.start();
    await flush();

    host.grantRoles('remote', ['mixer']);
    await flush();
    remote.sendControl({
      intentId: 'before-drop',
      role: 'mixer',
      target: 'mixer.crossfader',
      action: 'set',
      value: 0,
    });
    await flush();
    expect(received).toEqual(['before-drop']);

    a1.close();
    await flush();
    expect(host.status().authority.owners.mixer).toBeUndefined();
    expect(remote.status().authority.owners.mixer).toBeUndefined();

    const [a2, b2] = MemoryTransport.pair();
    host.replaceTransport(a2);
    remote.replaceTransport(b2);
    await flush();

    expect(() => remote.sendControl({
      intentId: 'stale-after-reconnect',
      role: 'mixer',
      target: 'mixer.crossfader',
      action: 'set',
      value: 1,
    })).toThrow(/does not own/);

    host.grantRoles('remote', ['mixer']);
    await flush();
    remote.sendControl({
      intentId: 'fresh-after-reconnect',
      role: 'mixer',
      target: 'mixer.crossfader',
      action: 'set',
      value: 1,
    });
    await flush();
    expect(received).toEqual(['before-drop', 'fresh-after-reconnect']);
    host.close();
    remote.close();
  });


});
