import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('GET /api/meters/{id} returns a previously created meter @api', async ({
  request,
}) => {
  const serialNumber = `SN-TEST-${randomUUID()}`;

  const createResponse = await request.post('/api/meters', {
    data: {
      serialNumber,
      status: 'ONLINE',
      firmwareVersion: '1.0.0',
    },
  });

  expect(createResponse.status()).toBe(201);

  const location = createResponse.headers()['location'];

  expect(location).toBeTruthy();

  if (!location) {
    throw new Error('The create response did not contain a Location header.');
  }

  expect(location).toMatch(/^\/api\/meters\/[0-9a-f-]+$/);

  const getResponse = await request.get(location);

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
  request,
}) => {
  const unknownId = randomUUID();

  const response = await request.get(`/api/meters/${unknownId}`);

  expect(response.status()).toBe(404);
});