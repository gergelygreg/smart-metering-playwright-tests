import { expect, test } from '@playwright/test';
import { MeterDetailPage } from '../../src/ui/pages/MeterDetailPage';
import {
  createMeterViaApi,
  deleteMeterIfExists,
  uniqueSerial,
} from './helpers/meter-api-helper';

test.describe('Meter telemetry and alarm UI @ui', () => {
  test('renders persisted meter identity and firmware', async ({
    page,
    request,
  }) => {
    const meter = await createMeterViaApi(request, {
      serialNumber: uniqueSerial('UI-DETAIL'),
      firmwareVersion: '5.2.0',
    });

    try {
      const detail = new MeterDetailPage(page);
      await detail.goto(meter.id);
      await detail.expectMeter(meter.serialNumber, '5.2.0');
      await expect(page.getByTestId('reading-count')).toHaveText('0');
      await expect(page.getByTestId('active-alarm-count')).toHaveText('0');
    } finally {
      await deleteMeterIfExists(request, meter.id);
    }
  });

  test('stores a normal reading without producing an alarm', async ({
    page,
    request,
  }) => {
    const meter = await createMeterViaApi(request, {
      serialNumber: uniqueSerial('UI-NORMAL'),
    });

    try {
      const detail = new MeterDetailPage(page);

      await detail.goto(meter.id);
      await detail.createReading({
        voltage: 230,
        current: 4.2,
        activePower: 966,
        energyKwh: 14001.2,
      });

      await detail.expectReadingVoltage(230);
      await detail.expectNoAlarms();
      await expect(page.getByTestId('reading-count')).toHaveText('1');
    } finally {
      await deleteMeterIfExists(request, meter.id);
    }
  });

  test('creates and acknowledges a high-voltage alarm and keeps ACK after reload', async ({
    page,
    request,
  }) => {
    const meter = await createMeterViaApi(request, {
      serialNumber: uniqueSerial('UI-ALARM'),
    });

    try {
      const detail = new MeterDetailPage(page);

      await detail.goto(meter.id);
      await detail.createReading({
        voltage: 260,
        current: 4.2,
        activePower: 1092,
        energyKwh: 14002.1,
      });

      await detail.expectReadingVoltage(260);
      await detail.acknowledgeFirstHighVoltageAlarm();

      await page.reload();
      await detail.expectAcknowledgedAlarm();
      await expect(page.getByTestId('active-alarm-count')).toHaveText('0');
    } finally {
      await deleteMeterIfExists(request, meter.id);
    }
  });

  test('deletes the meter from detail view and returns to the fleet', async ({
    page,
    request,
  }) => {
    const meter = await createMeterViaApi(request, {
      serialNumber: uniqueSerial('UI-DETAIL-DELETE'),
    });

    const detail = new MeterDetailPage(page);

    await detail.goto(meter.id);
    await detail.deleteMeter();

    const response = await request.get(`/api/meters/${meter.id}`);
    expect(response.status()).toBe(404);
  });
});