import type { AuthoritySnapshot, DistributedRole } from './DistributedTypes';

export class SessionAuthority {
  private generation = 0;
  private readonly owners = new Map<DistributedRole, string>();

  constructor(readonly hostNodeId: string) {}

  grantByHost(actorNodeId: string, nodeId: string, roles: DistributedRole[]): AuthoritySnapshot {
    if (actorNodeId !== this.hostNodeId) throw new Error('only the session host can grant distributed roles');
    this.generation += 1;
    this.apply(nodeId, roles);
    return this.snapshot();
  }

  applyGrant(actorNodeId: string, nodeId: string, roles: DistributedRole[], generation: number): AuthoritySnapshot {
    if (actorNodeId !== this.hostNodeId) throw new Error('role grant did not come from the session host');
    if (generation <= this.generation) return this.snapshot();
    this.generation = generation;
    this.apply(nodeId, roles);
    return this.snapshot();
  }

  canControl(nodeId: string, role: DistributedRole): boolean {
    return this.owners.get(role) === nodeId;
  }

  revokeNode(actorNodeId: string, nodeId: string): AuthoritySnapshot {
    if (actorNodeId !== this.hostNodeId) throw new Error('only the session host can revoke distributed roles');
    this.generation += 1;
    for (const [role, owner] of this.owners) {
      if (owner === nodeId) this.owners.delete(role);
    }
    return this.snapshot();
  }

  rolesFor(nodeId: string): DistributedRole[] {
    const roles: DistributedRole[] = [];
    for (const [role, owner] of this.owners) {
      if (owner === nodeId) roles.push(role);
    }
    return roles;
  }

  invalidateLocalView(): AuthoritySnapshot {
    this.owners.clear();
    return this.snapshot();
  }

  snapshot(): AuthoritySnapshot {
    const owners: Partial<Record<DistributedRole, string>> = {};
    for (const [role, nodeId] of this.owners) owners[role] = nodeId;
    return { generation: this.generation, owners };
  }

  private apply(nodeId: string, roles: DistributedRole[]): void {
    for (const [role, owner] of this.owners) {
      if (owner === nodeId) this.owners.delete(role);
    }
    for (const role of roles) this.owners.set(role, nodeId);
  }
}
