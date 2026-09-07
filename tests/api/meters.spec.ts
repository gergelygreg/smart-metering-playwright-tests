import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('POST /api/meters creates an online meter @api', async ({
  request,
}) => {
  const serialNumber = `SN-TEST-${randomUUID()}`;

  const response = await request.post('/api/meters', {
    data: {
      serialNumber,
      status: 'ONLINE',
      firmwareVersion: '1.0.0',
    },
  });

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