import { expect, test } from '@playwright/test';
import { MeterListPage } from '../../src/ui/pages/MeterListPage';
import {
  createMeterViaApi,
  deleteMeterIfExists,
  findMeterBySerial,
  uniqueSerial,
} from './helpers/meter-api-helper';

test.describe('Smart meter fleet UI @ui', () => {
  test('loads the operations shell and backend health', async ({ page }) => {
    const fleet = new MeterListPage(page);

    await fleet.goto();

    await expect(page.getByTestId('app-brand')).toContainText(
      'Smart Metering Operations',
    );
    await expect(fleet.health).toContainText('API UP');
  });

  test('creates a meter from the Angular form and exposes it in the fleet', async ({
    page,
    request,
  }) => {
    const fleet = new MeterListPage(page);
    const serialNumber = uniqueSerial('UI-CREATE');
    let meterId: string | undefined;

    try {
      await fleet.goto();
      await fleet.createMeter(serialNumber, 'ONLINE', '3.4.1');

      const row = fleet.rowBySerial(serialNumber);
      await expect(row).toContainText('ONLINE');
      await expect(row).toContainText('3.4.1');

      const meter = await findMeterBySerial(request, serialNumber);
      expect(meter).toBeDefined();
      meterId = meter?.id;
    } finally {
      await deleteMeterIfExists(request, meterId);
    }
  });

  test('keeps create action disabled while required meter data is missing', async ({
    page,
  }) => {
    const fleet = new MeterListPage(page);

    await fleet.goto();
    await page.getByTestId('serial-number-input').fill('');
    await page.getByTestId('firmware-version-input').fill('');

    await expect(fleet.createButton).toBeDisabled();
  });

  test('deletes an existing aggregate from the fleet page', async ({
    page,
    request,
  }) => {
    const meter = await createMeterViaApi(request, {
      serialNumber: uniqueSerial('UI-DELETE'),
    });

    const fleet = new MeterListPage(page);

    await fleet.goto();
    await expect(fleet.rowBySerial(meter.serialNumber)).toBeVisible();

    await fleet.deleteMeter(meter.serialNumber);

    const response = await request.get(`/api/meters/${meter.id}`);
    expect(response.status()).toBe(404);
  });
});