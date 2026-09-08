import { test, expect } from '../../src/fixtures/api-fixtures.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';
import type { MeterResponse } from '../../src/models/meter.js';

test('GET /api/meters returns previously created meters @api', async ({
  meterApi,
}) => {
  const payloads = [
    new MeterBuilder().build(),
    new MeterBuilder()
      .withStatus('OFFLINE')
      .withFirmwareVersion('1.1.0')
      .build(),
  ];

  const createdMeters: MeterResponse[] = [];

  for (const payload of payloads) {
    const createResponse = await meterApi.createMeter(payload);

    expect(createResponse.status()).toBe(201);

    const body: unknown = await createResponse.json();

    expect(body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        ...payload,
      }),
    );

    createdMeters.push(body as MeterResponse);
  }

  const response = await meterApi.getAllMeters();

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');

  const body: unknown = await response.json();

  expect(Array.isArray(body)).toBe(true);
  expect(body).toEqual(expect.arrayContaining(createdMeters));
});