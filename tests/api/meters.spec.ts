import { test, expect } from '../../src/fixtures/api-fixtures.js';

import { MeterBuilder } from '../../src/builders/MeterBuilder.js';

test('POST /api/meters creates an online meter @api', async ({
  meterApi,
}) => {
  const payload = new MeterBuilder().build();
  const { serialNumber } = payload;

  const response = await meterApi.createMeter(payload);

  expect(response.status()).toBe(201);

  const body: unknown = await response.json();

  expect(body).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      serialNumber,
      status: 'ONLINE',
      firmwareVersion: '1.0.0',
    }),
  );

  const meter = body as { id: string };

  expect(meter.id.length).toBeGreaterThan(0);
  expect(response.headers()['location']).toBe(
    `/api/meters/${meter.id}`,
  );
});