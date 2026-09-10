import { test, expect } from '../../src/fixtures/api-fixtures.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';
import { ReadingBuilder } from '../../src/builders/ReadingBuilder.js';

test('POST /api/meters/{meterId}/readings creates a meter reading @api', async ({
  meterApi,
  readingApi,
}) => {
  const meterPayload = new MeterBuilder().build();

  const meterResponse = await meterApi.createMeter(meterPayload);

  expect(meterResponse.status()).toBe(201);

  const meter: unknown = await meterResponse.json();

  if (
    typeof meter !== 'object' ||
    meter === null ||
    !('id' in meter) ||
    typeof meter.id !== 'string' ||
    meter.id.length === 0
  ) {
    throw new Error('The created meter response has no valid ID.');
  }

  const readingPayload = new ReadingBuilder().build();

  const response = await readingApi.createReading(
    meter.id,
    readingPayload,
  );

  expect(response.status()).toBe(201);
  expect(response.headers()['content-type']).toContain(
    'application/json',
  );

  const body: unknown = await response.json();

  expect(body).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      meterId: meter.id,
      ...readingPayload,
    }),
  );

  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    typeof body.id !== 'string'
  ) {
    throw new Error('The reading response has no valid ID.');
  }

  expect(response.headers()['location']).toBe(
    `/api/meters/${meter.id}/readings/${body.id}`,
  );
});
