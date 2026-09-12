import type { DomainEvent } from './contracts.js';

export interface StoredEvent {
  topic: string;
  partition: number;
  offset: string;
  receivedAt: string;
  event: DomainEvent;
}

export class EventStore {
  private readonly events: StoredEvent[] = [];
  private readonly ids = new Set<string>();

  constructor(private readonly maxItems = 500) {}

  append(item: StoredEvent): boolean {
    if (this.ids.has(item.event.eventId)) {
      return false;
    }

    this.events.push(item);
    this.ids.add(item.event.eventId);

    while (this.events.length > this.maxItems) {
      const removed = this.events.shift();
      if (removed) {
        this.ids.delete(removed.event.eventId);
      }
    }

    return true;
  }

  list(query: {
    correlationId?: string;
    meterId?: string;
    eventType?: string;
  } = {}): StoredEvent[] {
    return this.events.filter((item) =>
      (!query.correlationId ||
        item.event.correlationId === query.correlationId) &&
      (!query.meterId ||
        item.event.meterId === query.meterId) &&
      (!query.eventType ||
        item.event.eventType === query.eventType),
    );
  }

  size(): number {
    return this.events.length;
  }
}
