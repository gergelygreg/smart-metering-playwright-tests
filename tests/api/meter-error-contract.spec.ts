import { test, expect } from '../../src/fixtures/api-fixtures.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';
import type { ApiProblem } from '../../src/models/api-error.js';

test('POST /api/meters returns a structured validation problem @api', async ({
  request,
}) => {
  const payload = new MeterBuilder()
    .withFirmwareVersion('   ')
    .build();

  const response = await request.post('/api/meters', {
    data: payload,
  });

  expect(response.status()).toBe(400);
  expect(response.headers()['content-type']).toContain(
    'application/problem+json',
  );

  const body: unknown = await response.json();

  const expected: Pick<
    ApiProblem,
    'type' | 'title' | 'status' | 'detail' | 'instance' | 'code'
  > = {
    type: 'about:blank',
    title: 'Bad Request',
    status: 400,
    detail: 'Request validation failed.',
    instance: '/api/meters',
    code: 'VALIDATION_ERROR',
  };

  expect(body).toMatchObject({
    ...expected,
    errors: expect.arrayContaining([
      expect.objectContaining({
        field: 'firmwareVersion',
        code: 'REQUIRED',
      }),
    ]),
  });
});