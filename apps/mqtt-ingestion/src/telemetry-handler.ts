import { telemetrySchema, toReadingRequest } from './contracts.js';
import type { BackendClient } from './backend-client.js';
import { MessageDeduplicator } from './deduplicator.js';
import { meterIdFromTelemetryTopic } from './topic.js';

export interface IngestionMetrics {
  received: number;
  ingested: number;
  duplicates: number;
  rejected: number;
  failed: number;
}

export class TelemetryHandler {
  readonly metrics: IngestionMetrics = {
    received: 0,
    ingested: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
  };

  constructor(
    private readonly backend: BackendClient,
    private readonly deduplicator = new MessageDeduplicator(),
  ) {}

  async handle(topic: string, rawPayload: Buffer): Promise<void> {
    this.metrics.received += 1;

    const topicMeterId = meterIdFromTelemetryTopic(topic);
    if (!topicMeterId) {
      this.metrics.rejected += 1;
      return;
    }

    let json: unknown;

    try {
      json = JSON.parse(rawPayload.toString('utf8'));
    } catch {
      this.metrics.rejected += 1;
      return;
    }

    const parsed = telemetrySchema.safeParse(json);
    if (!parsed.success) {
      this.metrics.rejected += 1;
      return;
    }

    const telemetry = parsed.data;

    if (telemetry.meterId.toLowerCase() !== topicMeterId.toLowerCase()) {
      this.metrics.rejected += 1;
      return;
    }

    if (!this.deduplicator.begin(telemetry.messageId)) {
      this.metrics.duplicates += 1;
      return;
    }

    try {
      await this.backend.createReading(
        telemetry.meterId,
        toReadingRequest(telemetry),
      );

      this.deduplicator.complete(telemetry.messageId);
      this.metrics.ingested += 1;
    } catch (error) {
      this.deduplicator.release(telemetry.messageId);
      this.metrics.failed += 1;
      throw error;
    }
  }
}