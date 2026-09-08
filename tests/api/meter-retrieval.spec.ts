import { randomUUID } from 'node:crypto';
import { test, expect } from '../../src/fixtures/api-fixtures.js';

import { MeterBuilder } from '../../src/builders/MeterBuilder.js';

test('GET /api/meters/{id} returns a previously created meter @api', async ({
  meterApi,
}) => {
  const payload = new MeterBuilder().build();
  const { serialNumber } = payload;

  const createResponse = await meterApi.createMeter(payload);

  expect(createResponse.status()).toBe(201);

  const location = createResponse.headers()['location'];

  expect(location).toBeTruthy();

  if (!location) {
    throw new Error('The create response did not contain a Location header.');
  }

  expect(location).toMatch(/^\/api\/meters\/[0-9a-f-]+$/);

  const meterId = location.substring('/api/meters/'.length);

  const getResponse = await meterApi.getMeterById(meterId);

  expect(getResponse.status()).toBe(200);
  expect(getResponse.headers()['content-type']).toContain('application/json');

  const body: unknown = await getResponse.json();

  expect(body).toEqual({
    id: expect.any(String),
    serialNumber,
    status: 'ONLINE',
    firmwareVersion: '1.0.0',
  });
});

test('GET /api/meters/{id} returns 404 for an unknown meter @api', async ({
  meterApi,
}) => {
  const unknownId = randomUUID();


  const response = await meterApi.getMeterById(unknownId);

  expect(response.status()).toBe(404);
});