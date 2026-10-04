export const DISTRIBUTED_PROTOCOL = 'libertas.distributed.v1' as const;
export const DISTRIBUTED_CHANNEL_LABEL = 'libertas-control-v1' as const;

export const DISTRIBUTED_ROLES = [
  'deck-a',
  'deck-b',
  'mixer',
  'fx',
  'pads',
  'worker',
  'observer',
  'agent',
] as const;

export type DistributedRole = typeof DISTRIBUTED_ROLES[number];

export const DISTRIBUTED_CAPABILITIES = [
  'control',
  'library-manifest',
  'analysis',
  'render',
  'reconstruction',
  'agent',
  'webrtc-datachannel',
] as const;

export type DistributedCapability = typeof DISTRIBUTED_CAPABILITIES[number];

export type RemoteWorkKind = 'analysis' | 'render' | 'reconstruction' | 'agent';

export interface DistributedNode {
  nodeId: string;
  label: string;
  capabilities: DistributedCapability[];
  requestedRoles: DistributedRole[];
}

export type ControlAction =
  | 'set'
  | 'trigger'
  | 'load'
  | 'play'
  | 'pause'
  | 'cue'
  | 'hotcue'
  | 'loop'
  | 'jog'
  | 'sync-toggle';

export interface ControlIntent {
  intentId: string;
  role: DistributedRole;
  target: string;
  action: ControlAction;
  value?: string | number | boolean | null;
  parameters?: Record<string, string | number | boolean | null>;
}

export interface StateSnapshot {
  snapshotId: string;
  values: Record<string, string | number | boolean | null>;
}

export interface TrackManifest {
  contentId: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface RemoteWorkRequest {
  jobId: string;
  kind: RemoteWorkKind;
  inputRefs: string[];
  parameters: Record<string, string | number | boolean | null>;
}

export interface RemoteWorkResult {
  jobId: string;
  kind: RemoteWorkKind;
  ok: boolean;
  outputRefs: string[];
  metrics: Record<string, string | number | boolean | null>;
  error?: string;
}

export type DistributedMessageKind =
  | 'hello'
  | 'role-grant'
  | 'control-intent'
  | 'state-snapshot'
  | 'track-manifest'
  | 'work-request'
  | 'work-result';

export interface DistributedEnvelope {
  protocol: typeof DISTRIBUTED_PROTOCOL;
  sessionId: string;
  senderNodeId: string;
  seq: number;
  sentAtMs: number;
  kind: DistributedMessageKind;
  payload: unknown;
}

export interface AuthoritySnapshot {
  generation: number;
  owners: Partial<Record<DistributedRole, string>>;
}

export interface SessionPeer {
  node: DistributedNode;
  negotiatedCapabilities: DistributedCapability[];
}
