import { test, expect } from '@playwright/test';

test('GET /api/health returns the application health @smoke', async ({
  request,
}) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');

  const body: unknown = await response.json();

  expect(body).toEqual({
    status: 'UP',
    service: 'smart-metering-api',
  });
});