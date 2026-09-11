import { expect, test } from '@playwright/test';
import {
  buildTelemetry,
  createMeter,
  deleteMeter,
  publishTelemetry,
} from './mqtt-test-helper';

test.describe('MQTT smart-meter telemetry ingestion @mqtt', () => {
  test('normal MQTT telemetry becomes a persisted meter reading', async ({
    request,
  }) => {
    const meter = await createMeter(request);

    try {
      await publishTelemetry(
        meter.id,
        buildTelemetry(meter, {
          voltage: 230,
        }),
      );

      await expect
        .poll(async () => {
          const response = await request.get(
            `/api/meters/${meter.id}/readings`,
          );

          expect(response.status()).toBe(200);
          return ((await response.json()) as unknown[]).length;
        })
        .toBe(1);

      const alarmsResponse = await request.get(
        `/api/meters/${meter.id}/alarms`,
      );

      expect(alarmsResponse.status()).toBe(200);
      expect(await alarmsResponse.json()).toEqual([]);
    } finally {
      await deleteMeter(request, meter.id);
    }
  });

  test('high-voltage MQTT telemetry creates a domain alarm', async ({
    request,
  }) => {
    const meter = await createMeter(request);

    try {
      await publishTelemetry(
        meter.id,
        buildTelemetry(meter, {
          voltage: 260,
          activePower: 1037.4,
        }),
      );

      await expect
        .poll(async () => {
          const response = await request.get(
            `/api/meters/${meter.id}/alarms`,
          );

          expect(response.status()).toBe(200);
          return (await response.json()) as Array<{
            type: string;
            status: string;
          }>;
        })
        .toEqual([
          expect.objectContaining({
            type: 'HIGH_VOLTAGE',
            status: 'ACTIVE',
          }),
        ]);
    } finally {
      await deleteMeter(request, meter.id);
    }
  });

  test('duplicate MQTT message id is ingested only once', async ({
    request,
  }) => {
    const meter = await createMeter(request);

    try {
      const telemetry = buildTelemetry(meter);

      await publishTelemetry(meter.id, telemetry);
      await publishTelemetry(meter.id, telemetry);

      await expect
        .poll(async () => {
          const response = await request.get(
            `/api/meters/${meter.id}/readings`,
          );

          return ((await response.json()) as unknown[]).length;
        })
        .toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 700));

      const response = await request.get(
        `/api/meters/${meter.id}/readings`,
      );

      expect(((await response.json()) as unknown[]).length).toBe(1);
    } finally {
      await deleteMeter(request, meter.id);
    }
  });

  test('malformed MQTT telemetry is rejected without creating a reading', async ({
    request,
  }) => {
    const meter = await createMeter(request);

    try {
      await publishTelemetry(meter.id, {
        meterId: meter.id,
        voltage: 'not-a-number',
      });

      await new Promise((resolve) => setTimeout(resolve, 700));

      const response = await request.get(
        `/api/meters/${meter.id}/readings`,
      );

      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual([]);
    } finally {
      await deleteMeter(request, meter.id);
    }
  });
});