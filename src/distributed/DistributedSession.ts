import {
  DISTRIBUTED_PROTOCOL,
  type ControlIntent,
  type DistributedEnvelope,
  type DistributedNode,
  type DistributedRole,
  type RemoteWorkKind,
  type RemoteWorkRequest,
  type RemoteWorkResult,
  type SessionPeer,
  type StateSnapshot,
  type TrackManifest,
} from './DistributedTypes';
import {
  SequenceGate,
  assertExplicitControlIntent,
  capabilityForWork,
  decodeEnvelope,
  encodeEnvelope,
  intersectCapabilities,
  validateNode,
  validateWorkRequest,
} from './DistributedProtocol';
import { SessionAuthority } from './SessionAuthority';
import type { DistributedTransport } from './DistributedTransport';

type WorkHandler = (
  request: RemoteWorkRequest,
  senderNodeId: string,
) => Promise<Omit<RemoteWorkResult, 'jobId' | 'kind'>> | Omit<RemoteWorkResult, 'jobId' | 'kind'>;

export interface DistributedSessionOptions {
  sessionId: string;
  hostNodeId: string;
  localNode: DistributedNode;
  transport: DistributedTransport;
  workHandlers?: Partial<Record<RemoteWorkKind, WorkHandler>>;
  onControlIntent?: (intent: ControlIntent, senderNodeId: string) => void;
  onStateSnapshot?: (snapshot: StateSnapshot, senderNodeId: string) => void;
  onTrackManifest?: (track: TrackManifest, senderNodeId: string) => void;
  now?: () => number;
}

export interface DistributedSessionStatus {
  sessionId: string;
  localNodeId: string;
  hostNodeId: string;
  transportState: DistributedTransport['state'];
  peers: SessionPeer[];
  authority: ReturnType<SessionAuthority['snapshot']>;
  acceptedMessages: number;
  rejectedMessages: number;
  duplicateOrStaleMessages: number;
  pendingWork: number;
}

interface PendingWork {
  kind: RemoteWorkKind;
  resolve: (result: RemoteWorkResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class DistributedSession {
  private readonly authority: SessionAuthority;
  private readonly sequenceGate = new SequenceGate();
  private readonly peers = new Map<string, SessionPeer>();
  private readonly pendingWork = new Map<string, PendingWork>();
  private unsubscribe: (() => void) | null = null;
  private outgoingSeq = 0;
  private acceptedMessages = 0;
  private rejectedMessages = 0;
  private duplicateOrStaleMessages = 0;

  constructor(private readonly options: DistributedSessionOptions) {
    if (!options.sessionId) throw new Error('sessionId must be non-empty');
    if (!options.hostNodeId) throw new Error('hostNodeId must be non-empty');
    validateNode(options.localNode);
    this.authority = new SessionAuthority(options.hostNodeId);
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.options.transport.onMessage((raw) => this.receive(raw));
    this.send('hello', { node: this.options.localNode });
  }

  close(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const pending of this.pendingWork.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('distributed session closed'));
    }
    this.pendingWork.clear();
    this.options.transport.close();
  }

  status(): DistributedSessionStatus {
    return {
      sessionId: this.options.sessionId,
      localNodeId: this.options.localNode.nodeId,
      hostNodeId: this.options.hostNodeId,
      transportState: this.options.transport.state,
      peers: [...this.peers.values()].map((peer) => ({
        node: { ...peer.node, capabilities: [...peer.node.capabilities], requestedRoles: [...peer.node.requestedRoles] },
        negotiatedCapabilities: [...peer.negotiatedCapabilities],
      })),
      authority: this.authority.snapshot(),
      acceptedMessages: this.acceptedMessages,
      rejectedMessages: this.rejectedMessages,
      duplicateOrStaleMessages: this.duplicateOrStaleMessages,
      pendingWork: this.pendingWork.size,
    };
  }

  grantRoles(nodeId: string, roles: DistributedRole[]): void {
    const snapshot = this.authority.grantByHost(this.options.localNode.nodeId, nodeId, roles);
    this.send('role-grant', { nodeId, roles, generation: snapshot.generation });
  }

  revokeNode(nodeId: string): void {
    const snapshot = this.authority.revokeNode(this.options.localNode.nodeId, nodeId);
    this.send('role-grant', { nodeId, roles: [], generation: snapshot.generation });
  }

  sendControl(intent: ControlIntent): void {
    assertExplicitControlIntent(intent);
    if (!this.authority.canControl(this.options.localNode.nodeId, intent.role)) {
      throw new Error(`local node does not own distributed role ${intent.role}`);
    }
    this.send('control-intent', { intent });
  }

  publishState(snapshot: StateSnapshot): void {
    this.send('state-snapshot', { snapshot });
  }

  publishTrack(track: TrackManifest): void {
    this.send('track-manifest', { track });
  }

  requestWork(
    kind: RemoteWorkKind,
    inputRefs: string[],
    parameters: Record<string, string | number | boolean | null> = {},
    timeoutMs = 10_000,
  ): Promise<RemoteWorkResult> {
    const required = capabilityForWork(kind);
    const peerSupports = [...this.peers.values()].some((peer) => peer.negotiatedCapabilities.includes(required));
    if (!peerSupports) {
      return Promise.reject(new Error(`no negotiated peer capability for ${kind}`));
    }
    const request: RemoteWorkRequest = {
      jobId: `${this.options.localNode.nodeId}-${this.outgoingSeq + 1}-${Math.floor(this.now())}`,
      kind,
      inputRefs,
      parameters,
    };
    validateWorkRequest(request);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingWork.delete(request.jobId);
        reject(new Error(`remote work timed out: ${request.jobId}`));
      }, timeoutMs);
      this.pendingWork.set(request.jobId, { kind, resolve, reject, timer });
      try {
        this.send('work-request', { request });
      } catch (error) {
        clearTimeout(timer);
        this.pendingWork.delete(request.jobId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private send(kind: DistributedEnvelope['kind'], payload: unknown): void {
    this.outgoingSeq += 1;
    const envelope: DistributedEnvelope = {
      protocol: DISTRIBUTED_PROTOCOL,
      sessionId: this.options.sessionId,
      senderNodeId: this.options.localNode.nodeId,
      seq: this.outgoingSeq,
      sentAtMs: this.now(),
      kind,
      payload,
    };
    this.options.transport.send(encodeEnvelope(envelope));
  }

  private receive(raw: string): void {
    let envelope: DistributedEnvelope;
    try {
      envelope = decodeEnvelope(raw);
      if (envelope.sessionId !== this.options.sessionId) throw new Error('distributed session id mismatch');
      if (envelope.senderNodeId === this.options.localNode.nodeId) throw new Error('self-sent distributed message rejected');
      if (!this.sequenceGate.accept(envelope.senderNodeId, envelope.seq)) {
        this.duplicateOrStaleMessages += 1;
        return;
      }
      this.acceptedMessages += 1;
    } catch {
      this.rejectedMessages += 1;
      return;
    }

    switch (envelope.kind) {
      case 'hello':
        this.handleHello(envelope);
        break;
      case 'role-grant':
        this.handleRoleGrant(envelope);
        break;
      case 'control-intent':
        this.handleControlIntent(envelope);
        break;
      case 'state-snapshot':
        this.handleStateSnapshot(envelope);
        break;
      case 'track-manifest':
        this.handleTrackManifest(envelope);
        break;
      case 'work-request':
        void this.handleWorkRequest(envelope);
        break;
      case 'work-result':
        this.handleWorkResult(envelope);
        break;
    }
  }

  private handleHello(envelope: DistributedEnvelope): void {
    const payload = envelope.payload as { node: unknown };
    const node = validateNode(payload.node);
    if (node.nodeId !== envelope.senderNodeId) {
      this.rejectedMessages += 1;
      return;
    }
    this.peers.set(node.nodeId, {
      node,
      negotiatedCapabilities: intersectCapabilities(this.options.localNode.capabilities, node.capabilities),
    });
  }

  private handleRoleGrant(envelope: DistributedEnvelope): void {
    if (!isRecord(envelope.payload)) return;
    const nodeId = String(envelope.payload.nodeId);
    const roles = envelope.payload.roles as DistributedRole[];
    const generation = Number(envelope.payload.generation);
    try {
      this.authority.applyGrant(envelope.senderNodeId, nodeId, roles, generation);
    } catch {
      this.rejectedMessages += 1;
    }
  }

  private handleControlIntent(envelope: DistributedEnvelope): void {
    if (!isRecord(envelope.payload)) return;
    try {
      const intent = envelope.payload.intent;
      assertExplicitControlIntent(intent);
      if (!this.authority.canControl(envelope.senderNodeId, intent.role)) {
        this.rejectedMessages += 1;
        return;
      }
      this.options.onControlIntent?.(intent, envelope.senderNodeId);
    } catch {
      this.rejectedMessages += 1;
    }
  }

  private handleStateSnapshot(envelope: DistributedEnvelope): void {
    if (!isRecord(envelope.payload) || !isRecord(envelope.payload.snapshot)) return;
    const snapshot = envelope.payload.snapshot as unknown as StateSnapshot;
    this.options.onStateSnapshot?.(snapshot, envelope.senderNodeId);
  }

  private handleTrackManifest(envelope: DistributedEnvelope): void {
    if (!isRecord(envelope.payload) || !isRecord(envelope.payload.track)) return;
    const track = envelope.payload.track as unknown as TrackManifest;
    this.options.onTrackManifest?.(track, envelope.senderNodeId);
  }

  private async handleWorkRequest(envelope: DistributedEnvelope): Promise<void> {
    if (!isRecord(envelope.payload)) return;
    let request: RemoteWorkRequest;
    try {
      request = validateWorkRequest(envelope.payload.request);
    } catch {
      this.rejectedMessages += 1;
      return;
    }
    const capability = capabilityForWork(request.kind);
    if (!this.options.localNode.capabilities.includes(capability)) {
      this.send('work-result', {
        result: {
          jobId: request.jobId,
          kind: request.kind,
          ok: false,
          outputRefs: [],
          metrics: {},
          error: `local node lacks ${capability} capability`,
        } satisfies RemoteWorkResult,
      });
      return;
    }
    const handler = this.options.workHandlers?.[request.kind];
    if (!handler) {
      this.send('work-result', {
        result: {
          jobId: request.jobId,
          kind: request.kind,
          ok: false,
          outputRefs: [],
          metrics: {},
          error: `no handler for ${request.kind}`,
        } satisfies RemoteWorkResult,
      });
      return;
    }

    try {
      const result = await handler(request, envelope.senderNodeId);
      this.send('work-result', {
        result: {
          jobId: request.jobId,
          kind: request.kind,
          ...result,
        } satisfies RemoteWorkResult,
      });
    } catch (error) {
      this.send('work-result', {
        result: {
          jobId: request.jobId,
          kind: request.kind,
          ok: false,
          outputRefs: [],
          metrics: {},
          error: error instanceof Error ? error.message : String(error),
        } satisfies RemoteWorkResult,
      });
    }
  }

  private handleWorkResult(envelope: DistributedEnvelope): void {
    if (!isRecord(envelope.payload) || !isRecord(envelope.payload.result)) return;
    const result = envelope.payload.result as unknown as RemoteWorkResult;
    const pending = this.pendingWork.get(result.jobId);
    if (!pending || pending.kind !== result.kind) {
      this.rejectedMessages += 1;
      return;
    }
    clearTimeout(pending.timer);
    this.pendingWork.delete(result.jobId);
    pending.resolve(result);
  }
}
