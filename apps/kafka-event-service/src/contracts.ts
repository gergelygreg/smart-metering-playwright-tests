import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const TELEMETRY_TOPIC =
  'smart-metering.telemetry.received.v1';
export const READING_TOPIC =
  'smart-metering.reading.persisted.v1';
export const ALARM_TOPIC =
  'smart-metering.alarm.created.v1';

const telemetryPayloadSchema = z.object({
  messageId: z.string().uuid(),
  meterId: z.string().uuid(),
  serialNumber: z.string().min(1),
  firmwareVersion: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  voltage: z.number().positive(),
  current: z.number().nonnegative(),
  activePower: z.number(),
  energyKwh: z.number().nonnegative(),
  sequence: z.number().int().positive(),
  source: z.literal('smart-meter-device-simulator'),
});

export const telemetryEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('smart-metering.telemetry.received'),
  eventVersion: z.literal(1),
  occurredAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
  meterId: z.string().uuid(),
  payload: telemetryPayloadSchema,
});

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

export interface ReadingResponse {
  id: string;
  meterId: string;
  timestamp: string;
  voltage: number;
  current: number;
  activePower: number;
  energyKwh: number;
}

export interface AlarmResponse {
  id: string;
  meterId: string;
  sourceReadingId: string;
  type: string;
  severity: string;
  status: string;
  detectedAt: string;
  actualValue: number;
  threshold: number;
  acknowledgedAt: string | null;
}

export const readingEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('smart-metering.reading.persisted'),
  eventVersion: z.literal(1),
  occurredAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid(),
  meterId: z.string().uuid(),
  payload: z.object({
    readingId: z.string().min(1),
    timestamp: z.string().datetime({ offset: true }),
    voltage: z.number(),
    current: z.number(),
    activePower: z.number(),
    energyKwh: z.number(),
    sourceSequence: z.number().int().positive(),
  }),
});

export const alarmEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('smart-metering.alarm.created'),
  eventVersion: z.literal(1),
  occurredAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid(),
  meterId: z.string().uuid(),
  payload: z.object({
    alarmId: z.string().min(1),
    sourceReadingId: z.string().min(1),
    type: z.string().min(1),
    severity: z.string().min(1),
    status: z.string().min(1),
    detectedAt: z.string().datetime({ offset: true }),
    actualValue: z.number(),
    threshold: z.number(),
  }),
});

export type ReadingEvent = z.infer<typeof readingEventSchema>;
export type AlarmEvent = z.infer<typeof alarmEventSchema>;
export type DomainEvent = ReadingEvent | AlarmEvent;

export function readingRequest(event: TelemetryEvent) {
  return {
    timestamp: event.payload.timestamp,
    voltage: event.payload.voltage,
    current: event.payload.current,
    activePower: event.payload.activePower,
    energyKwh: event.payload.energyKwh,
  };
}

export function createReadingEvent(
  source: TelemetryEvent,
  reading: ReadingResponse,
): ReadingEvent {
  return {
    eventId: randomUUID(),
    eventType: 'smart-metering.reading.persisted',
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: source.correlationId,
    causationId: source.eventId,
    meterId: source.meterId,
    payload: {
      readingId: reading.id,
      timestamp: reading.timestamp,
      voltage: reading.voltage,
      current: reading.current,
      activePower: reading.activePower,
      energyKwh: reading.energyKwh,
      sourceSequence: source.payload.sequence,
    },
  };
}

export function createAlarmEvent(
  source: TelemetryEvent,
  readingEvent: ReadingEvent,
  alarm: AlarmResponse,
): AlarmEvent {
  return {
    eventId: randomUUID(),
    eventType: 'smart-metering.alarm.created',
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: source.correlationId,
    causationId: readingEvent.eventId,
    meterId: source.meterId,
    payload: {
      alarmId: alarm.id,
      sourceReadingId: alarm.sourceReadingId,
      type: alarm.type,
      severity: alarm.severity,
      status: alarm.status,
      detectedAt: alarm.detectedAt,
      actualValue: alarm.actualValue,
      threshold: alarm.threshold,
    },
  };
}

export function parseDomainEvent(
  topic: string,
  value: unknown,
): DomainEvent | null {
  const schema =
    topic === READING_TOPIC
      ? readingEventSchema
      : topic === ALARM_TOPIC
        ? alarmEventSchema
        : null;

  if (!schema) {
    return null;
  }

  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
