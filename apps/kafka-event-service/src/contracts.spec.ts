import { describe, expect, it } from 'vitest';
import {
  ALARM_TOPIC,
  READING_TOPIC,
  createAlarmEvent,
  createReadingEvent,
  parseDomainEvent,
  telemetryEventSchema,
  type AlarmResponse,
  type ReadingResponse,
} from './contracts.js';

const telemetry = {
  eventId: '89140b57-1929-445c-8a64-5f3750038454',
  eventType: 'smart-metering.telemetry.received' as const,
  eventVersion: 1 as const,
  occurredAt: '2026-09-11T18:00:00.000Z',
  correlationId: 'fdd414e8-b36d-4659-a455-c07a29b06739',
  meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
  payload: {
    messageId: 'fdd414e8-b36d-4659-a455-c07a29b06739',
    meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
    serialNumber: 'SIM-0001',
    firmwareVersion: 'sim-1.0.0',
    timestamp: '2026-09-11T18:00:00.000Z',
    voltage: 260,
    current: 4.2,
    activePower: 1037.4,
    energyKwh: 12543.8,
    sequence: 4,
    source: 'smart-meter-device-simulator' as const,
  },
};

describe('Kafka event contracts', () => {
  it('accepts telemetry v1', () => {
    expect(telemetryEventSchema.safeParse(telemetry).success).toBe(true);
  });

  it('rejects unsupported telemetry versions', () => {
    expect(
      telemetryEventSchema.safeParse({
        ...telemetry,
        eventVersion: 2,
      }).success,
    ).toBe(false);
  });

  it('creates and parses a reading event', () => {
    const reading: ReadingResponse = {
      id: 'reading-1',
      meterId: telemetry.meterId,
      timestamp: telemetry.payload.timestamp,
      voltage: 260,
      current: 4.2,
      activePower: 1037.4,
      energyKwh: 12543.8,
    };

    const event = createReadingEvent(telemetry, reading);

    expect(event).toMatchObject({
      correlationId: telemetry.correlationId,
      causationId: telemetry.eventId,
      payload: { sourceSequence: 4 },
    });
    expect(parseDomainEvent(READING_TOPIC, event)).not.toBeNull();
  });

  it('creates and parses an alarm event', () => {
    const reading: ReadingResponse = {
      id: 'reading-1',
      meterId: telemetry.meterId,
      timestamp: telemetry.payload.timestamp,
      voltage: 260,
      current: 4.2,
      activePower: 1037.4,
      energyKwh: 12543.8,
    };
    const readingEvent = createReadingEvent(telemetry, reading);
    const alarm: AlarmResponse = {
      id: 'alarm-1',
      meterId: telemetry.meterId,
      sourceReadingId: reading.id,
      type: 'HIGH_VOLTAGE',
      severity: 'WARNING',
      status: 'ACTIVE',
      detectedAt: '2026-09-11T18:00:01.000Z',
      actualValue: 260,
      threshold: 253,
      acknowledgedAt: null,
    };

    const event = createAlarmEvent(telemetry, readingEvent, alarm);

    expect(event.causationId).toBe(readingEvent.eventId);
    expect(parseDomainEvent(ALARM_TOPIC, event)).not.toBeNull();
  });
});
