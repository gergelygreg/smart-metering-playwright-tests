import { expect, Locator, Page } from '@playwright/test';

export class MeterDetailPage {
  readonly heading: Locator;
  readonly readingTable: Locator;
  readonly alarmList: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByTestId('meter-detail-heading');
    this.readingTable = page.getByTestId('reading-table');
    this.alarmList = page.getByTestId('alarm-list');
  }

  async goto(meterId: string): Promise<void> {
    await this.page.goto(`/meters/${meterId}`);
    await expect(this.heading).toBeVisible();
  }

  async expectMeter(
    serialNumber: string,
    firmwareVersion: string,
  ): Promise<void> {
    await expect(this.page.getByTestId('meter-detail-serial')).toHaveText(
      serialNumber,
    );
    await expect(this.page.getByTestId('meter-detail-firmware')).toHaveText(
      firmwareVersion,
    );
  }

  async createReading(options: {
    voltage: number;
    current?: number;
    activePower?: number;
    energyKwh?: number;
  }): Promise<void> {
    const timestamp = new Date().toISOString().slice(0, 19);

    await this.page.getByTestId('reading-timestamp').fill(timestamp);
    await this.page
      .getByTestId('reading-voltage')
      .fill(String(options.voltage));
    await this.page
      .getByTestId('reading-current')
      .fill(String(options.current ?? 4.2));
    await this.page
      .getByTestId('reading-active-power')
      .fill(String(options.activePower ?? 966));
    await this.page
      .getByTestId('reading-energy')
      .fill(String(options.energyKwh ?? 12543.8));

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/meters/') &&
        response.url().endsWith('/readings') &&
        response.request().method() === 'POST',
    );

    await this.page.getByTestId('create-reading-button').click();

    const response = await responsePromise;
    const responseBody = await response.text();

    expect(
      response.status(),
      `Angular reading creation failed: ${response.status()} ${responseBody}`,
    ).toBe(201);
  }

  async expectReadingVoltage(voltage: number): Promise<void> {
    await expect(this.readingTable).toContainText(`${voltage} V`);
  }

  async expectNoAlarms(): Promise<void> {
    await expect(this.page.getByTestId('alarms-empty')).toBeVisible();
  }

  async activeAlarm(): Promise<Locator> {
    const alarm = this.page
      .locator('[data-testid^="alarm-card-"]')
      .filter({ hasText: 'HIGH_VOLTAGE' })
      .first();

    await expect(alarm).toBeVisible();
    await expect(alarm).toContainText('ACTIVE');

    return alarm;
  }

  async acknowledgeFirstHighVoltageAlarm(): Promise<void> {
    const alarm = await this.activeAlarm();

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/alarms/') &&
        response.url().endsWith('/acknowledge') &&
        response.request().method() === 'POST',
    );

    await alarm.getByRole('button', { name: 'Acknowledge' }).click();

    const response = await responsePromise;
    const responseBody = await response.text();

    expect(
      response.status(),
      `Angular alarm acknowledgement failed: ${response.status()} ${responseBody}`,
    ).toBe(200);

    await expect(alarm).toContainText('ACKNOWLEDGED');
  }

  async expectAcknowledgedAlarm(): Promise<void> {
    const alarm = this.page
      .locator('[data-testid^="alarm-card-"]')
      .filter({ hasText: 'HIGH_VOLTAGE' })
      .first();

    await expect(alarm).toBeVisible();
    await expect(alarm).toContainText('ACKNOWLEDGED');
  }

  async deleteMeter(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/meters/') &&
        response.request().method() === 'DELETE',
    );

    this.page.once('dialog', (dialog) => dialog.accept());
    await this.page.getByTestId('delete-meter-detail').click();

    const response = await responsePromise;
    const responseBody = await response.text();

    expect(
      response.status(),
      `Angular detail meter deletion failed: ${response.status()} ${responseBody}`,
    ).toBe(204);

    await expect(this.page).toHaveURL(/\/meters$/);
  }
}