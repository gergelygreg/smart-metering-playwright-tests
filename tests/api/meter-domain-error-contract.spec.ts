import { randomUUID } from 'node:crypto';

import { test, expect } from '../../src/fixtures/api-fixtures.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';
import type { ApiProblem } from '../../src/models/api-error.js';

type ProblemContract = Pick<
  ApiProblem,
  'type' | 'title' | 'status' | 'detail' | 'instance' | 'code'
>;

test.describe('Meter domain error contracts @api', () => {
  test('returns a structured problem for an unknown meter', async ({
    meterApi,
  }) => {
    const unknownId = randomUUID();

    const response = await meterApi.getMeterById(unknownId);

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain(
      'application/problem+json',
    );

    const body: unknown = await response.json();

    const expected: ProblemContract = {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Meter not found.',
      instance: `/api/meters/${unknownId}`,
      code: 'METER_NOT_FOUND',
    };

    expect(body).toMatchObject(expected);
  });

  test('returns a structured conflict without changing the original meter', async ({
    meterApi,
  }) => {
    const payload = new MeterBuilder().build();

    const createResponse = await meterApi.createMeter(payload);

    expect(createResponse.status()).toBe(201);

    const created: unknown = await createResponse.json();

    expect(created).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        ...payload,
      }),
    );

    if (
      typeof created !== 'object' ||
      created === null ||
      !('id' in created) ||
      typeof created.id !== 'string'
    ) {
      throw new Error('The created meter response has no valid ID.');
    }

    const duplicateResponse = await meterApi.createMeter(payload);

    expect(duplicateResponse.status()).toBe(409);
    expect(duplicateResponse.headers()['content-type']).toContain(
      'application/problem+json',
    );

    const problem: unknown = await duplicateResponse.json();

    const expected: ProblemContract = {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'A meter with this serial number already exists.',
      instance: '/api/meters',
      code: 'METER_SERIAL_CONFLICT',
    };

    expect(problem).toMatchObject(expected);

    const getResponse = await meterApi.getMeterById(created.id);

    expect(getResponse.status()).toBe(200);

    const retrieved: unknown = await getResponse.json();

    expect(retrieved).toEqual(created);
  });
});