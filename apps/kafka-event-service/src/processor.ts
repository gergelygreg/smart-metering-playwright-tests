import type { BackendClient } from './backend-client.js';
import {
  createAlarmEvent,
  createReadingEvent,
  telemetryEventSchema,
} from './contracts.js';
import { EventDeduplicator } from './deduplicator.js';
import type { DomainEventPublisher } from './event-publisher.js';

export interface ProcessorMetrics {
  received: number;
  processed: number;
  duplicates: number;
  rejected: number;
  failed: number;
  readingEventsPublished: number;
  alarmEventsPublished: number;
}

export class TelemetryProcessor {
  readonly metrics: ProcessorMetrics = {
    received: 0,
    processed: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
    readingEventsPublished: 0,
    alarmEventsPublished: 0,
  };

  constructor(
    private readonly backend: BackendClient,
    private readonly publisher: DomainEventPublisher,
    private readonly deduplicator = new EventDeduplicator(),
  ) {}

  async handle(rawValue: Buffer): Promise<void> {
    this.metrics.received += 1;

    let json: unknown;
    try {
      json = JSON.parse(rawValue.toString('utf8'));
    } catch {
      this.metrics.rejected += 1;
      return;
    }

    const parsed = telemetryEventSchema.safeParse(json);
    if (!parsed.success) {
      this.metrics.rejected += 1;
      return;
    }

    const event = parsed.data;

    if (event.meterId.toLowerCase() !== event.payload.meterId.toLowerCase()) {
      this.metrics.rejected += 1;
      return;
    }

    if (!this.deduplicator.begin(event.eventId)) {
      this.metrics.duplicates += 1;
      return;
    }

    try {
      const reading = await this.backend.createReading(event);
      const readingEvent = createReadingEvent(event, reading);

      await this.publisher.publishReading(readingEvent);
      this.metrics.readingEventsPublished += 1;

      const alarms = await this.backend.getAlarms(event.meterId);
      const sourceAlarms = alarms.filter(
        (alarm) => alarm.sourceReadingId === reading.id,
      );

      for (const alarm of sourceAlarms) {
        await this.publisher.publishAlarm(
          createAlarmEvent(event, readingEvent, alarm),
        );
        this.metrics.alarmEventsPublished += 1;
      }

      this.deduplicator.complete(event.eventId);
      this.metrics.processed += 1;
    } catch (error) {
      this.deduplicator.release(event.eventId);
      this.metrics.failed += 1;
      throw error;
    }
  }
}
