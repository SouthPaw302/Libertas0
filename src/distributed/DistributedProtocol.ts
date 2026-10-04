import {
  DISTRIBUTED_CAPABILITIES,
  DISTRIBUTED_PROTOCOL,
  DISTRIBUTED_ROLES,
  type ControlIntent,
  type DistributedCapability,
  type DistributedEnvelope,
  type DistributedMessageKind,
  type DistributedNode,
  type DistributedRole,
  type RemoteWorkKind,
  type RemoteWorkRequest,
} from './DistributedTypes';

const MESSAGE_KINDS: DistributedMessageKind[] = [
  'hello',
  'role-grant',
  'control-intent',
  'state-snapshot',
  'track-manifest',
  'work-request',
  'work-result',
];

const WORK_KINDS: RemoteWorkKind[] = ['analysis', 'render', 'reconstruction', 'agent'];
const CONTROL_ACTIONS = ['set', 'trigger', 'load', 'play', 'pause', 'cue', 'hotcue', 'loop', 'jog', 'sync-toggle'];

const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'sourceframe',
  'renderframe',
  'outputcurrentframe',
  'musicalclock',
  'phasecorrection',
  'synctargetrate',
  'synccorrectionrate',
  'syncsnapshot',
  'audiocurrentframe',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}

function containsForbiddenAuthorityKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenAuthorityKey);
  if (!isRecord(value)) return false;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_AUTHORITY_KEYS.has(key.toLowerCase())) return true;
    if (containsForbiddenAuthorityKey(child)) return true;
  }
  return false;
}

export function assertExplicitControlIntent(value: unknown): asserts value is ControlIntent {
  if (!isRecord(value)) throw new Error('control intent must be an object');
  requireString(value.intentId, 'intentId');
  if (!DISTRIBUTED_ROLES.includes(value.role as DistributedRole)) throw new Error('control intent role is invalid');
  requireString(value.target, 'target');
  if (!CONTROL_ACTIONS.includes(String(value.action))) throw new Error('control action is invalid');
  if (containsForbiddenAuthorityKey(value)) {
    throw new Error('network control intent attempted to carry realtime musical authority');
  }
}

export function validateNode(value: unknown): DistributedNode {
  if (!isRecord(value)) throw new Error('node must be an object');
  const capabilities = requireStringArray(value.capabilities, 'node.capabilities');
  const requestedRoles = requireStringArray(value.requestedRoles, 'node.requestedRoles');
  if (capabilities.some((capability) => !DISTRIBUTED_CAPABILITIES.includes(capability as DistributedCapability))) {
    throw new Error('node capability is invalid');
  }
  if (requestedRoles.some((role) => !DISTRIBUTED_ROLES.includes(role as DistributedRole))) {
    throw new Error('node requested role is invalid');
  }
  return {
    nodeId: requireString(value.nodeId, 'node.nodeId'),
    label: requireString(value.label, 'node.label'),
    capabilities: capabilities as DistributedCapability[],
    requestedRoles: requestedRoles as DistributedRole[],
  };
}

export function validateWorkRequest(value: unknown): RemoteWorkRequest {
  if (!isRecord(value)) throw new Error('work request must be an object');
  if (!WORK_KINDS.includes(value.kind as RemoteWorkKind)) throw new Error('work kind is invalid');
  const inputRefs = requireStringArray(value.inputRefs, 'work.inputRefs');
  if (!isRecord(value.parameters)) throw new Error('work.parameters must be an object');
  const parameters: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value.parameters)) {
    if (item !== null && !['string', 'number', 'boolean'].includes(typeof item)) {
      throw new Error('work parameter must be scalar JSON');
    }
    parameters[key] = item as string | number | boolean | null;
  }
  return {
    jobId: requireString(value.jobId, 'work.jobId'),
    kind: value.kind as RemoteWorkKind,
    inputRefs,
    parameters,
  };
}

function validatePayload(kind: DistributedMessageKind, payload: unknown): void {
  if (!isRecord(payload)) throw new Error(`${kind} payload must be an object`);
  switch (kind) {
    case 'hello':
      validateNode(payload.node);
      return;
    case 'role-grant':
      requireString(payload.nodeId, 'role-grant.nodeId');
      if (!Array.isArray(payload.roles) || payload.roles.some((role) => !DISTRIBUTED_ROLES.includes(role as DistributedRole))) {
        throw new Error('role-grant.roles is invalid');
      }
      if (!Number.isInteger(payload.generation) || Number(payload.generation) < 1) throw new Error('role-grant.generation is invalid');
      return;
    case 'control-intent':
      assertExplicitControlIntent(payload.intent);
      return;
    case 'work-request':
      validateWorkRequest(payload.request);
      return;
    case 'work-result':
      requireString((payload.result as Record<string, unknown> | undefined)?.jobId, 'work-result.jobId');
      return;
    case 'state-snapshot':
      requireString((payload.snapshot as Record<string, unknown> | undefined)?.snapshotId, 'snapshot.snapshotId');
      return;
    case 'track-manifest':
      requireString((payload.track as Record<string, unknown> | undefined)?.contentId, 'track.contentId');
      return;
  }
}

export function encodeEnvelope(envelope: DistributedEnvelope): string {
  validateEnvelope(envelope);
  return JSON.stringify(envelope);
}

export function decodeEnvelope(raw: string, maxBytes = 262_144): DistributedEnvelope {
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error('distributed message exceeds size limit');
  const parsed: unknown = JSON.parse(raw);
  return validateEnvelope(parsed);
}

export function validateEnvelope(value: unknown): DistributedEnvelope {
  if (!isRecord(value)) throw new Error('distributed envelope must be an object');
  if (value.protocol !== DISTRIBUTED_PROTOCOL) throw new Error('distributed protocol mismatch');
  const kind = value.kind as DistributedMessageKind;
  if (!MESSAGE_KINDS.includes(kind)) throw new Error('distributed message kind is invalid');
  const envelope: DistributedEnvelope = {
    protocol: DISTRIBUTED_PROTOCOL,
    sessionId: requireString(value.sessionId, 'sessionId'),
    senderNodeId: requireString(value.senderNodeId, 'senderNodeId'),
    seq: Number(value.seq),
    sentAtMs: Number(value.sentAtMs),
    kind,
    payload: value.payload,
  };
  if (!Number.isInteger(envelope.seq) || envelope.seq < 1) throw new Error('seq must be a positive integer');
  if (!Number.isFinite(envelope.sentAtMs)) throw new Error('sentAtMs must be finite');
  validatePayload(kind, envelope.payload);
  return envelope;
}

export function intersectCapabilities(
  local: DistributedCapability[],
  remote: DistributedCapability[],
): DistributedCapability[] {
  const remoteSet = new Set(remote);
  return DISTRIBUTED_CAPABILITIES.filter((capability) => local.includes(capability) && remoteSet.has(capability));
}

export function capabilityForWork(kind: RemoteWorkKind): DistributedCapability {
  return kind;
}

export class SequenceGate {
  private readonly latest = new Map<string, number>();

  accept(senderNodeId: string, seq: number): boolean {
    const previous = this.latest.get(senderNodeId) ?? 0;
    if (seq <= previous) return false;
    this.latest.set(senderNodeId, seq);
    return true;
  }

  last(senderNodeId: string): number {
    return this.latest.get(senderNodeId) ?? 0;
  }
}
