import { describe, expect, it, vi } from 'vitest';
import type { BackendClient } from './backend-client.js';
import type {
  AlarmResponse,
  ReadingResponse,
} from './contracts.js';
import type { DomainEventPublisher } from './event-publisher.js';
import { TelemetryProcessor } from './processor.js';

function payload(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(
    JSON.stringify({
      eventId: '89140b57-1929-445c-8a64-5f3750038454',
      eventType: 'smart-metering.telemetry.received',
      eventVersion: 1,
      occurredAt: '2026-09-11T18:00:00.000Z',
      correlationId: 'fdd414e8-b36d-4659-a455-c07a29b06739',
      meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
      payload: {
        messageId: 'fdd414e8-b36d-4659-a455-c07a29b06739',
        meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
        serialNumber: 'SIM-0001',
        firmwareVersion: 'sim-1.0.0',
        timestamp: '2026-09-11T18:00:00.000Z',
        voltage: 230,
        current: 4.2,
        activePower: 917.7,
        energyKwh: 12543.8,
        sequence: 1,
        source: 'smart-meter-device-simulator',
      },
      ...overrides,
    }),
  );
}

function setup(alarms: AlarmResponse[] = []) {
  const reading: ReadingResponse = {
    id: 'reading-1',
    meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
    timestamp: '2026-09-11T18:00:00.000Z',
    voltage: 230,
    current: 4.2,
    activePower: 917.7,
    energyKwh: 12543.8,
  };

  const createReading = vi.fn().mockResolvedValue(reading);
  const getAlarms = vi.fn().mockResolvedValue(alarms);
  const publishReading = vi.fn().mockResolvedValue(undefined);
  const publishAlarm = vi.fn().mockResolvedValue(undefined);

  const backend: BackendClient = { createReading, getAlarms };
  const publisher: DomainEventPublisher = {
    publishReading,
    publishAlarm,
  };

  return {
    processor: new TelemetryProcessor(backend, publisher),
    createReading,
    publishReading,
    publishAlarm,
  };
}

describe('TelemetryProcessor', () => {
  it('persists telemetry and publishes reading event', async () => {
    const { processor, createReading, publishReading } = setup();
    await processor.handle(payload());

    expect(createReading).toHaveBeenCalledTimes(1);
    expect(publishReading).toHaveBeenCalledTimes(1);
    expect(processor.metrics.processed).toBe(1);
  });

  it('publishes matching alarm events', async () => {
    const alarm: AlarmResponse = {
      id: 'alarm-1',
      meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
      sourceReadingId: 'reading-1',
      type: 'HIGH_VOLTAGE',
      severity: 'WARNING',
      status: 'ACTIVE',
      detectedAt: '2026-09-11T18:00:01.000Z',
      actualValue: 260,
      threshold: 253,
      acknowledgedAt: null,
    };

    const { processor, publishAlarm } = setup([alarm]);
    await processor.handle(payload());

    expect(publishAlarm).toHaveBeenCalledTimes(1);
  });

  it('drops duplicate event ids', async () => {
    const { processor, createReading } = setup();
    await processor.handle(payload());
    await processor.handle(payload());

    expect(createReading).toHaveBeenCalledTimes(1);
    expect(processor.metrics.duplicates).toBe(1);
  });

  it('rejects invalid event versions', async () => {
    const { processor, createReading } = setup();
    await processor.handle(payload({ eventVersion: 2 }));

    expect(createReading).not.toHaveBeenCalled();
    expect(processor.metrics.rejected).toBe(1);
  });

  it('releases failed events for retry', async () => {
    const { processor, createReading } = setup();

    createReading
      .mockRejectedValueOnce(new Error('backend unavailable'))
      .mockResolvedValueOnce({
        id: 'reading-1',
        meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
        timestamp: '2026-09-11T18:00:00.000Z',
        voltage: 230,
        current: 4.2,
        activePower: 917.7,
        energyKwh: 12543.8,
      });

    await expect(processor.handle(payload())).rejects.toThrow(
      'backend unavailable',
    );
    await processor.handle(payload());

    expect(createReading).toHaveBeenCalledTimes(2);
    expect(processor.metrics.processed).toBe(1);
  });
});
