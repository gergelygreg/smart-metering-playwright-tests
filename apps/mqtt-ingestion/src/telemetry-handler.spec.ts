import { describe, expect, it, vi } from 'vitest';
import type { TelemetryEventPublisher } from './kafka-publisher.js';
import { TelemetryHandler } from './telemetry-handler.js';

function validPayload(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(
    JSON.stringify({
      messageId: 'fdd414e8-b36d-4659-a455-c07a29b06739',
      meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
      serialNumber: 'SIM-0001',
      firmwareVersion: 'sim-1.0.0',
      timestamp: '2026-09-11T12:00:00.000Z',
      voltage: 230,
      current: 4.2,
      activePower: 917.7,
      energyKwh: 12543.8,
      sequence: 1,
      source: 'smart-meter-device-simulator',
      ...overrides,
    }),
  );
}

describe('TelemetryHandler', () => {
  const topic =
    'smart-metering/meters/d2719db7-013b-4bb0-a56d-3793dc6be90f/telemetry';

  it('publishes a valid telemetry event once', async () => {
    const publishTelemetry = vi.fn().mockResolvedValue(undefined);
    const publisher: TelemetryEventPublisher = { publishTelemetry };
    const handler = new TelemetryHandler(publisher);

    await handler.handle(topic, validPayload());

    expect(publishTelemetry).toHaveBeenCalledTimes(1);
    expect(publishTelemetry.mock.calls[0][0]).toMatchObject({
      eventType: 'smart-metering.telemetry.received',
      eventVersion: 1,
      correlationId: 'fdd414e8-b36d-4659-a455-c07a29b06739',
    });
    expect(handler.metrics.published).toBe(1);
  });

  it('drops duplicate device message ids before Kafka', async () => {
    const publishTelemetry = vi.fn().mockResolvedValue(undefined);
    const handler = new TelemetryHandler({ publishTelemetry });

    await handler.handle(topic, validPayload());
    await handler.handle(topic, validPayload());

    expect(publishTelemetry).toHaveBeenCalledTimes(1);
    expect(handler.metrics.duplicates).toBe(1);
  });

  it('rejects topic/payload meter mismatch', async () => {
    const publishTelemetry = vi.fn().mockResolvedValue(undefined);
    const handler = new TelemetryHandler({ publishTelemetry });

    await handler.handle(
      topic,
      validPayload({
        meterId: '7cecd108-46dd-4120-9f1f-c670dd0d628c',
      }),
    );

    expect(publishTelemetry).not.toHaveBeenCalled();
    expect(handler.metrics.rejected).toBe(1);
  });

  it('rejects malformed JSON', async () => {
    const publishTelemetry = vi.fn();
    const handler = new TelemetryHandler({ publishTelemetry });

    await handler.handle(topic, Buffer.from('{not-json'));

    expect(publishTelemetry).not.toHaveBeenCalled();
    expect(handler.metrics.rejected).toBe(1);
  });

  it('releases failed Kafka publication for redelivery retry', async () => {
    const publishTelemetry = vi
      .fn()
      .mockRejectedValueOnce(new Error('kafka unavailable'))
      .mockResolvedValueOnce(undefined);

    const handler = new TelemetryHandler({ publishTelemetry });

    await expect(
      handler.handle(topic, validPayload()),
    ).rejects.toThrow('kafka unavailable');

    await handler.handle(topic, validPayload());

    expect(publishTelemetry).toHaveBeenCalledTimes(2);
    expect(handler.metrics.failed).toBe(1);
    expect(handler.metrics.published).toBe(1);
  });
});
