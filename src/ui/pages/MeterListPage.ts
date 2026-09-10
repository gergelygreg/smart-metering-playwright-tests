import { expect, Locator, Page } from '@playwright/test';

export class MeterListPage {
  readonly heading: Locator;
  readonly health: Locator;
  readonly createButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Meter fleet', level: 1 });
    this.health = page.getByTestId('service-health');
    this.createButton = page.getByTestId('create-meter-button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/meters');
    await expect(this.heading).toBeVisible();
  }

  rowBySerial(serialNumber: string): Locator {
    return this.page
      .getByTestId('meter-table')
      .getByRole('row')
      .filter({ hasText: serialNumber });
  }

  async createMeter(
    serialNumber: string,
    status: 'ONLINE' | 'OFFLINE' | 'FAULT' | 'MAINTENANCE' = 'ONLINE',
    firmwareVersion = '1.0.0',
  ): Promise<void> {
    await this.page.getByTestId('serial-number-input').fill(serialNumber);
    await this.page.getByTestId('meter-status-select').selectOption(status);
    await this.page
      .getByTestId('firmware-version-input')
      .fill(firmwareVersion);

    await expect(this.createButton).toBeEnabled();

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/meters') &&
        response.request().method() === 'POST',
    );

    await this.createButton.click();

    const response = await responsePromise;
    const responseBody = await response.text();

    expect(
      response.status(),
      `Angular meter creation failed: ${response.status()} ${responseBody}`,
    ).toBe(201);

    await expect(this.rowBySerial(serialNumber)).toBeVisible();
  }

  async openMeter(serialNumber: string): Promise<void> {
    const row = this.rowBySerial(serialNumber);
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: 'Open' }).click();
  }

  async deleteMeter(serialNumber: string): Promise<void> {
    const row = this.rowBySerial(serialNumber);
    await expect(row).toBeVisible();

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/meters/') &&
        response.request().method() === 'DELETE',
    );

    this.page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: 'Delete' }).click();

    const response = await responsePromise;
    const responseBody = await response.text();

    expect(
      response.status(),
      `Angular meter deletion failed: ${response.status()} ${responseBody}`,
    ).toBe(204);

    await expect(row).toHaveCount(0);
  }
}