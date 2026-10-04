import { DISTRIBUTED_CHANNEL_LABEL } from './DistributedTypes';
import type { DistributedTransport, DistributedTransportState } from './DistributedTransport';

export interface RtcDataChannelTransportOptions {
  maxBufferedBytes?: number;
}

export class RtcDataChannelTransport implements DistributedTransport {
  private readonly handlers = new Set<(raw: string) => void>();
  private readonly stateHandlers = new Set<(state: DistributedTransportState) => void>();
  private readonly maxBufferedBytes: number;

  constructor(readonly channel: RTCDataChannel, options: RtcDataChannelTransportOptions = {}) {
    if (channel.label !== DISTRIBUTED_CHANNEL_LABEL) {
      throw new Error(`unexpected RTCDataChannel label: ${channel.label}`);
    }
    this.maxBufferedBytes = options.maxBufferedBytes ?? 1_048_576;
    channel.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      for (const handler of this.handlers) handler(event.data);
    });
    for (const eventName of ['open', 'closing', 'close', 'error'] as const) {
      channel.addEventListener(eventName, () => this.emitState());
    }
  }

  get state(): DistributedTransportState {
    switch (this.channel.readyState) {
      case 'connecting':
        return 'connecting';
      case 'open':
        return 'open';
      case 'closing':
      case 'closed':
        return 'closed';
      default:
        return 'new';
    }
  }

  send(raw: string): void {
    if (this.channel.readyState !== 'open') throw new Error('RTCDataChannel is not open');
    const size = new TextEncoder().encode(raw).byteLength;
    if (this.channel.bufferedAmount + size > this.maxBufferedBytes) {
      throw new Error('RTCDataChannel backpressure limit exceeded');
    }
    this.channel.send(raw);
  }

  onMessage(handler: (raw: string) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStateChange(handler: (state: DistributedTransportState) => void): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  close(): void {
    this.handlers.clear();
    this.stateHandlers.clear();
    if (this.channel.readyState !== 'closed') this.channel.close();
  }

  private emitState(): void {
    const state = this.state;
    for (const handler of this.stateHandlers) handler(state);
  }
}
