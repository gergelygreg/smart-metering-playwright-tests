import { test, expect } from '../../src/fixtures/api-fixtures.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';
import { ReadingBuilder } from '../../src/builders/ReadingBuilder.js';

test('GET /api/meters/{meterId}/readings returns meter reading history @api', async ({
  meterApi,
  readingApi,
}) => {
  const meterResponse = await meterApi.createMeter(
    new MeterBuilder().build(),
  );

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

  const firstPayload = new ReadingBuilder()
    .withTimestamp('2026-01-01T12:00:00Z')
    .withVoltage(230.0)
    .withCurrent(4.2)
    .withActivePower(966.0)
    .withEnergyKwh(12543.8)
    .build();

  const secondPayload = new ReadingBuilder()
    .withTimestamp('2026-01-01T12:15:00Z')
    .withVoltage(231.5)
    .withCurrent(4.5)
    .withActivePower(1041.8)
    .withEnergyKwh(12544.1)
    .build();

  const firstResponse = await readingApi.createReading(
    meter.id,
    firstPayload,
  );

  expect(firstResponse.status()).toBe(201);

  const firstReading: unknown = await firstResponse.json();

  expect(firstReading).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      meterId: meter.id,
      ...firstPayload,
    }),
  );

  const secondResponse = await readingApi.createReading(
    meter.id,
    secondPayload,
  );

  expect(secondResponse.status()).toBe(201);

  const secondReading: unknown = await secondResponse.json();

  expect(secondReading).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      meterId: meter.id,
      ...secondPayload,
    }),
  );

  const response = await readingApi.getReadings(meter.id);

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain(
    'application/json',
  );

  const body: unknown = await response.json();

  expect(Array.isArray(body)).toBe(true);

  expect(body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        meterId: meter.id,
        ...firstPayload,
      }),
      expect.objectContaining({
        meterId: meter.id,
        ...secondPayload,
      }),
    ]),
  );
});
