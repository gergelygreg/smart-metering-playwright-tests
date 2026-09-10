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

test.describe('Meter reading validation contracts @api', () => {
  test('rejects a reading with missing timestamp', async ({
    meterApi,
    readingApi,
  }) => {
    const meterId = await createMeter(meterApi);

    const payload = {
      voltage: 230.0,
      current: 4.2,
      activePower: 966.0,
      energyKwh: 12543.8,
    };

    const response = await readingApi.createReading(
      meterId,
      payload as never,
    );

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain(
      'application/problem+json',
    );

    const problem: unknown = await response.json();

    expect(problem).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Request validation failed.',
      instance: `/api/meters/${meterId}/readings`,
      code: 'VALIDATION_ERROR',
    });

    expect(problem).toMatchObject({
      errors: expect.arrayContaining([
        expect.objectContaining({
          field: 'timestamp',
          code: 'REQUIRED',
        }),
      ]),
    });
  });

  test('rejects zero voltage', async ({
    meterApi,
    readingApi,
  }) => {
    const meterId = await createMeter(meterApi);

    const payload = new ReadingBuilder()
      .withVoltage(0)
      .build();

    const response = await readingApi.createReading(
      meterId,
      payload,
    );

    expect(response.status()).toBe(400);

    const problem: unknown = await response.json();

    expect(problem).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: expect.arrayContaining([
        expect.objectContaining({
          field: 'voltage',
          code: 'INVALID_VALUE',
        }),
      ]),
    });
  });

  test('rejects negative current', async ({
    meterApi,
    readingApi,
  }) => {
    const meterId = await createMeter(meterApi);

    const payload = new ReadingBuilder()
      .withCurrent(-0.1)
      .build();

    const response = await readingApi.createReading(
      meterId,
      payload,
    );

    expect(response.status()).toBe(400);

    const problem: unknown = await response.json();

    expect(problem).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: expect.arrayContaining([
        expect.objectContaining({
          field: 'current',
          code: 'INVALID_VALUE',
        }),
      ]),
    });
  });

  test('rejects negative cumulative energy', async ({
    meterApi,
    readingApi,
  }) => {
    const meterId = await createMeter(meterApi);

    const payload = new ReadingBuilder()
      .withEnergyKwh(-0.1)
      .build();

    const response = await readingApi.createReading(
      meterId,
      payload,
    );

    expect(response.status()).toBe(400);

    const problem: unknown = await response.json();

    expect(problem).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: expect.arrayContaining([
        expect.objectContaining({
          field: 'energyKwh',
          code: 'INVALID_VALUE',
        }),
      ]),
    });
  });

  test('rejects an invalid timestamp format', async ({
    meterApi,
    readingApi,
  }) => {
    const meterId = await createMeter(meterApi);

    const payload = {
      ...new ReadingBuilder().build(),
      timestamp: 'not-a-timestamp',
    };

    const response = await readingApi.createReading(
      meterId,
      payload,
    );

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain(
      'application/problem+json',
    );

    const problem: unknown = await response.json();

    expect(problem).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Request body is invalid.',
      instance: `/api/meters/${meterId}/readings`,
      code: 'INVALID_REQUEST_BODY',
    });
  });

  test('accepts negative active power for exported energy', async ({
    meterApi,
    readingApi,
  }) => {
    const meterId = await createMeter(meterApi);

    const payload = new ReadingBuilder()
      .withActivePower(-850.5)
      .build();

    const response = await readingApi.createReading(
      meterId,
      payload,
    );

    expect(response.status()).toBe(201);

    const body: unknown = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        meterId,
        activePower: -850.5,
      }),
    );
  });
});
