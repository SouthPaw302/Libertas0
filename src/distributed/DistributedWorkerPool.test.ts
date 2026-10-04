import { describe, expect, it } from 'vitest';
import { DistributedWorkerPool, type DistributedWorkerEndpoint } from './DistributedWorkerPool';
import type { DistributedCapability, RemoteWorkKind, RemoteWorkResult } from './DistributedTypes';

function worker(
  nodeId: string,
  capabilities: DistributedCapability[],
  delayMs: number,
  behavior?: (kind: RemoteWorkKind) => 'ok' | 'fail',
): DistributedWorkerEndpoint {
  return {
    nodeId,
    capabilities,
    async request(kind, inputRefs): Promise<RemoteWorkResult> {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      if (behavior?.(kind) === 'fail') {
        return {
          jobId: `${nodeId}-failed`,
          kind,
          ok: false,
          outputRefs: [],
          metrics: { nodeId },
          error: 'injected worker failure',
        };
      }
      return {
        jobId: `${nodeId}-ok`,
        kind,
        ok: true,
        outputRefs: [`${kind}:${nodeId}:${inputRefs[0] ?? 'none'}`],
        metrics: { nodeId },
      };
    },
  };
}

describe('DistributedWorkerPool', () => {
  it('routes concurrent jobs across equally capable workers by current load', async () => {
    const pool = new DistributedWorkerPool();
    pool.register(worker('worker-a', ['analysis'], 20));
    pool.register(worker('worker-b', ['analysis'], 20));

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        pool.request('analysis', [`sha256:${index}`])),
    );

    const nodes = results.map((result) => String(result.metrics.nodeId));
    expect(nodes.filter((node) => node === 'worker-a').length).toBe(10);
    expect(nodes.filter((node) => node === 'worker-b').length).toBe(10);
    expect(pool.status().reduce((sum, item) => sum + item.completed, 0)).toBe(20);
  });

  it('retries the next capable worker after explicit failure', async () => {
    const pool = new DistributedWorkerPool();
    pool.register(worker('worker-a', ['render'], 1, () => 'fail'));
    pool.register(worker('worker-b', ['render'], 1));

    const result = await pool.request('render', ['sha256:mix']);
    expect(result.ok).toBe(true);
    expect(result.metrics.nodeId).toBe('worker-b');
    expect(pool.status().find((item) => item.nodeId === 'worker-a')?.failures).toBe(1);
  });

  it('fails explicitly when no worker advertises the required capability', async () => {
    const pool = new DistributedWorkerPool();
    pool.register(worker('analysis-only', ['analysis'], 1));
    await expect(pool.request('reconstruction', ['sha256:stem']))
      .rejects.toThrow(/no distributed worker provides reconstruction/);
  });
});
