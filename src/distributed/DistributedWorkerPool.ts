import { capabilityForWork } from './DistributedProtocol';
import type {
  DistributedCapability,
  RemoteWorkKind,
  RemoteWorkResult,
} from './DistributedTypes';

export interface DistributedWorkerEndpoint {
  nodeId: string;
  capabilities: DistributedCapability[];
  request(
    kind: RemoteWorkKind,
    inputRefs: string[],
    parameters: Record<string, string | number | boolean | null>,
  ): Promise<RemoteWorkResult>;
}

export interface DistributedWorkerStatus {
  nodeId: string;
  capabilities: DistributedCapability[];
  inFlight: number;
  failures: number;
  completed: number;
}

interface WorkerEntry {
  endpoint: DistributedWorkerEndpoint;
  inFlight: number;
  failures: number;
  completed: number;
}

export class DistributedWorkerPool {
  private readonly workers = new Map<string, WorkerEntry>();

  register(endpoint: DistributedWorkerEndpoint): void {
    if (!endpoint.nodeId) throw new Error('worker nodeId must be non-empty');
    if (this.workers.has(endpoint.nodeId)) throw new Error(`worker already registered: ${endpoint.nodeId}`);
    this.workers.set(endpoint.nodeId, {
      endpoint,
      inFlight: 0,
      failures: 0,
      completed: 0,
    });
  }

  remove(nodeId: string): void {
    this.workers.delete(nodeId);
  }

  status(): DistributedWorkerStatus[] {
    return [...this.workers.values()]
      .map((entry) => ({
        nodeId: entry.endpoint.nodeId,
        capabilities: [...entry.endpoint.capabilities],
        inFlight: entry.inFlight,
        failures: entry.failures,
        completed: entry.completed,
      }))
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  }

  async request(
    kind: RemoteWorkKind,
    inputRefs: string[],
    parameters: Record<string, string | number | boolean | null> = {},
  ): Promise<RemoteWorkResult> {
    const capability = capabilityForWork(kind);
    const candidates = [...this.workers.values()]
      .filter((entry) => entry.endpoint.capabilities.includes(capability))
      .sort((a, b) =>
        a.inFlight - b.inFlight ||
        a.failures - b.failures ||
        a.endpoint.nodeId.localeCompare(b.endpoint.nodeId));

    if (candidates.length === 0) throw new Error(`no distributed worker provides ${capability}`);

    const errors: string[] = [];
    for (const entry of candidates) {
      entry.inFlight += 1;
      try {
        const result = await entry.endpoint.request(kind, inputRefs, parameters);
        if (!result.ok) {
          entry.failures += 1;
          errors.push(`${entry.endpoint.nodeId}: ${result.error ?? 'remote work failed'}`);
          continue;
        }
        entry.completed += 1;
        return result;
      } catch (error) {
        entry.failures += 1;
        errors.push(`${entry.endpoint.nodeId}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        entry.inFlight -= 1;
      }
    }
    throw new Error(`all distributed workers failed for ${kind}: ${errors.join('; ')}`);
  }
}
