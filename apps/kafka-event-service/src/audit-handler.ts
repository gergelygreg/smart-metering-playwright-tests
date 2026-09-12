import { parseDomainEvent } from './contracts.js';
import { EventStore } from './event-store.js';

export interface AuditMetrics {
  received: number;
  stored: number;
  duplicates: number;
  rejected: number;
}

export class AuditHandler {
  readonly metrics: AuditMetrics = {
    received: 0,
    stored: 0,
    duplicates: 0,
    rejected: 0,
  };

  constructor(private readonly store: EventStore) {}

  handle(
    topic: string,
    partition: number,
    offset: string,
    rawValue: Buffer,
  ): void {
    this.metrics.received += 1;

    let json: unknown;
    try {
      json = JSON.parse(rawValue.toString('utf8'));
    } catch {
      this.metrics.rejected += 1;
      return;
    }

    const event = parseDomainEvent(topic, json);
    if (!event) {
      this.metrics.rejected += 1;
      return;
    }

    const added = this.store.append({
      topic,
      partition,
      offset,
      receivedAt: new Date().toISOString(),
      event,
    });

    if (!added) {
      this.metrics.duplicates += 1;
      return;
    }

    this.metrics.stored += 1;
  }
}
