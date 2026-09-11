import { expect, test } from '@playwright/test';
import { MeterDetailPage } from '../../src/ui/pages/MeterDetailPage';
import {
  createMeterViaApi,
  deleteMeterIfExists,
  uniqueSerial,
} from './helpers/meter-api-helper';
import {
  buildTelemetry,
  publishTelemetry,
} from '../mqtt/mqtt-test-helper';

test.describe('MQTT device-to-UI flow @ui @mqtt', () => {
  test('high-voltage device telemetry reaches the Angular alarm view', async ({
    page,
    request,
  }) => {
    const meter = await createMeterViaApi(request, {
      serialNumber: uniqueSerial('UI-MQTT'),
      firmwareVersion: 'mqtt-ui-1.0.0',
    });

    try {
      const detail = new MeterDetailPage(page);
      await detail.goto(meter.id);

      await publishTelemetry(
        meter.id,
        buildTelemetry(
          {
            ...meter,
          },
          {
            voltage: 260,
            activePower: 1037.4,
          },
        ),
      );

      await expect
        .poll(async () => {
          const response = await request.get(
            `/api/meters/${meter.id}/alarms`,
          );

          return ((await response.json()) as unknown[]).length;
        })
        .toBe(1);

      await page.reload();

      await detail.expectReadingVoltage(260);

      const alarm = await detail.activeAlarm();
      await expect(alarm).toContainText('HIGH_VOLTAGE');
      await expect(alarm).toContainText('260');
    } finally {
      await deleteMeterIfExists(request, meter.id);
    }
  });
});