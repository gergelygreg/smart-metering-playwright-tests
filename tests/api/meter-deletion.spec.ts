import { randomUUID } from 'node:crypto';

import { test, expect } from '../../src/fixtures/api-fixtures.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';

test.describe('Meter deletion @api', () => {
  test('deletes an existing meter and makes it unavailable', async ({
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
      typeof created.id !== 'string' ||
      created.id.length === 0
    ) {
      throw new Error('The created meter response has no valid ID.');
    }

    const meterId = created.id;

    const deleteResponse = await meterApi.deleteMeter(meterId);

    expect(deleteResponse.status()).toBe(204);
    expect(await deleteResponse.body()).toHaveLength(0);

    const getResponse = await meterApi.getMeterById(meterId);

    expect(getResponse.status()).toBe(404);
    expect(getResponse.headers()['content-type']).toContain(
      'application/problem+json',
    );

    const problem: unknown = await getResponse.json();

    expect(problem).toMatchObject({
      status: 404,
      code: 'METER_NOT_FOUND',
      instance: `/api/meters/${meterId}`,
    });
  });

  test('returns a structured problem when deleting an unknown meter', async ({
    meterApi,
  }) => {
    const unknownId = randomUUID();

    const response = await meterApi.deleteMeter(unknownId);

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain(
      'application/problem+json',
    );

    const problem: unknown = await response.json();

    expect(problem).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Meter not found.',
      instance: `/api/meters/${unknownId}`,
      code: 'METER_NOT_FOUND',
    });
  });
});