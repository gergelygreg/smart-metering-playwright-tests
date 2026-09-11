import { describe, expect, it, vi } from 'vitest';
import type { BackendClient } from './backend-client.js';
import { TelemetryHandler } from './telemetry-handler.js';

function validPayload(
  overrides: Record<string, unknown> = {},
): Buffer {
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

  it('ingests a valid telemetry message once', async () => {
    const createReading = vi.fn().mockResolvedValue(undefined);
    const backend: BackendClient = { createReading };
    const handler = new TelemetryHandler(backend);

    await handler.handle(topic, validPayload());

    expect(createReading).toHaveBeenCalledTimes(1);
    expect(handler.metrics.ingested).toBe(1);
  });

  it('drops duplicate message ids', async () => {
    const createReading = vi.fn().mockResolvedValue(undefined);
    const backend: BackendClient = { createReading };
    const handler = new TelemetryHandler(backend);

    await handler.handle(topic, validPayload());
    await handler.handle(topic, validPayload());

    expect(createReading).toHaveBeenCalledTimes(1);
    expect(handler.metrics.duplicates).toBe(1);
  });

  it('rejects a meter id mismatch between topic and payload', async () => {
    const createReading = vi.fn().mockResolvedValue(undefined);
    const backend: BackendClient = { createReading };
    const handler = new TelemetryHandler(backend);

    await handler.handle(
      topic,
      validPayload({
        meterId: '7cecd108-46dd-4120-9f1f-c670dd0d628c',
      }),
    );

    expect(createReading).not.toHaveBeenCalled();
    expect(handler.metrics.rejected).toBe(1);
  });

  it('rejects malformed JSON', async () => {
    const createReading = vi.fn().mockResolvedValue(undefined);
    const backend: BackendClient = { createReading };
    const handler = new TelemetryHandler(backend);

    await handler.handle(topic, Buffer.from('{not-json'));

    expect(createReading).not.toHaveBeenCalled();
    expect(handler.metrics.rejected).toBe(1);
  });

  it('releases a failed message so the broker redelivery can retry it', async () => {
    const createReading = vi
      .fn()
      .mockRejectedValueOnce(new Error('backend unavailable'))
      .mockResolvedValueOnce(undefined);

    const backend: BackendClient = { createReading };
    const handler = new TelemetryHandler(backend);

    await expect(
      handler.handle(topic, validPayload()),
    ).rejects.toThrow('backend unavailable');

    await handler.handle(topic, validPayload());

    expect(createReading).toHaveBeenCalledTimes(2);
    expect(handler.metrics.failed).toBe(1);
    expect(handler.metrics.ingested).toBe(1);
  });
});