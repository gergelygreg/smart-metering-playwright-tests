import { randomUUID } from 'node:crypto';

import { test, expect } from '../../src/fixtures/api-fixtures.js';
import type { MeterApiClient } from '../../src/api/MeterApiClient.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';
import { ReadingBuilder } from '../../src/builders/ReadingBuilder.js';

async function createMeter(
  meterApi: MeterApiClient,
): Promise<string> {
  const response = await meterApi.createMeter(
    new MeterBuilder().build(),
  );

  expect(response.status()).toBe(201);

  const body: unknown = await response.json();

  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    typeof body.id !== 'string' ||
    body.id.length === 0
  ) {
    throw new Error('The created meter response has no valid ID.');
  }

  return body.id;
}

test.describe('Meter reading retrieval @api', () => {
  test('returns a previously created meter reading', async ({
    meterApi,
    readingApi,
  }) => {
    const meterId = await createMeter(meterApi);
    const payload = new ReadingBuilder().build();

    const createResponse = await readingApi.createReading(
      meterId,
      payload,
    );

    expect(createResponse.status()).toBe(201);

    const created: unknown = await createResponse.json();

    if (
      typeof created !== 'object' ||
      created === null ||
      !('id' in created) ||
      typeof created.id !== 'string' ||
      created.id.length === 0
    ) {
      throw new Error('The created reading response has no valid ID.');
    }

    const response = await readingApi.getReading(
      meterId,
      created.id,
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain(
      'application/json',
    );

    const retrieved: unknown = await response.json();

    expect(retrieved).toEqual(created);
  });

  test('returns a structured problem for an unknown reading', async ({
    meterApi,
    readingApi,
  }) => {
    const meterId = await createMeter(meterApi);
    const unknownReadingId = randomUUID();

    const response = await readingApi.getReading(
      meterId,
      unknownReadingId,
    );

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain(
      'application/problem+json',
    );

    const problem: unknown = await response.json();

    expect(problem).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Meter reading not found.',
      instance:
        `/api/meters/${meterId}/readings/${unknownReadingId}`,
      code: 'READING_NOT_FOUND',
    });
  });

  test('does not expose a reading through another meter', async ({
    meterApi,
    readingApi,
  }) => {
    const ownerMeterId = await createMeter(meterApi);
    const otherMeterId = await createMeter(meterApi);

    const createResponse = await readingApi.createReading(
      ownerMeterId,
      new ReadingBuilder().build(),
    );

    expect(createResponse.status()).toBe(201);

    const created: unknown = await createResponse.json();

    if (
      typeof created !== 'object' ||
      created === null ||
      !('id' in created) ||
      typeof created.id !== 'string' ||
      created.id.length === 0
    ) {
      throw new Error('The created reading response has no valid ID.');
    }

    const response = await readingApi.getReading(
      otherMeterId,
      created.id,
    );

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain(
      'application/problem+json',
    );

    const problem: unknown = await response.json();

    expect(problem).toMatchObject({
      status: 404,
      code: 'READING_NOT_FOUND',
      instance:
        `/api/meters/${otherMeterId}/readings/${created.id}`,
    });
  });
});
