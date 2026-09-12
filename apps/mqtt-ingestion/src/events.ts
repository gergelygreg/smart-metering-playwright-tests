import { randomUUID } from 'node:crypto';
import type { TelemetryMessage } from './contracts.js';

export const TELEMETRY_TOPIC =
  'smart-metering.telemetry.received.v1';

export interface TelemetryReceivedEvent {
  eventId: string;
  eventType: 'smart-metering.telemetry.received';
  eventVersion: 1;
  occurredAt: string;
  correlationId: string;
  meterId: string;
  payload: TelemetryMessage;
}

export function createTelemetryEvent(
  telemetry: TelemetryMessage,
): TelemetryReceivedEvent {
  return {
    eventId: randomUUID(),
    eventType: 'smart-metering.telemetry.received',
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: telemetry.messageId,
    meterId: telemetry.meterId,
    payload: telemetry,
  };
}
