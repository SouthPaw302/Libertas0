export type DistributedTransportState = 'new' | 'connecting' | 'open' | 'closed';

export interface DistributedTransport {
  readonly state: DistributedTransportState;
  send(raw: string): void;
  onMessage(handler: (raw: string) => void): () => void;
  close(): void;
}

export class MemoryTransport implements DistributedTransport {
  private peer: MemoryTransport | null = null;
  private handlers = new Set<(raw: string) => void>();
  private closed = false;

  static pair(): [MemoryTransport, MemoryTransport] {
    const a = new MemoryTransport();
    const b = new MemoryTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  get state(): DistributedTransportState {
    return this.closed ? 'closed' : 'open';
  }

  send(raw: string): void {
    if (this.closed) throw new Error('transport is closed');
    const peer = this.peer;
    if (!peer || peer.closed) throw new Error('transport peer is unavailable');
    queueMicrotask(() => peer.deliver(raw));
  }

  onMessage(handler: (raw: string) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  close(): void {
    this.closed = true;
    this.handlers.clear();
  }

  private deliver(raw: string): void {
    if (this.closed) return;
    for (const handler of this.handlers) handler(raw);
  }
}
