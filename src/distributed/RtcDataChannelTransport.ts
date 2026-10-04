import { DISTRIBUTED_CHANNEL_LABEL } from './DistributedTypes';
import type { DistributedTransport, DistributedTransportState } from './DistributedTransport';

export class RtcDataChannelTransport implements DistributedTransport {
  private readonly handlers = new Set<(raw: string) => void>();

  constructor(readonly channel: RTCDataChannel) {
    if (channel.label !== DISTRIBUTED_CHANNEL_LABEL) {
      throw new Error(`unexpected RTCDataChannel label: ${channel.label}`);
    }
    channel.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      for (const handler of this.handlers) handler(event.data);
    });
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
    this.channel.send(raw);
  }

  onMessage(handler: (raw: string) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  close(): void {
    this.handlers.clear();
    if (this.channel.readyState !== 'closed') this.channel.close();
  }
}
