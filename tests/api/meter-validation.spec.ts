import { test, expect } from '../../src/fixtures/api-fixtures.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';

test.describe('POST /api/meters negative contracts @api', () => {
  test('rejects a blank firmware version', async ({ request }) => {
    const payload = new MeterBuilder()
      .withFirmwareVersion('   ')
      .build();

    const response = await request.post('/api/meters', {
      data: payload,
    });

    expect(response.status()).toBe(400);
  });

  test('rejects a request with missing status', async ({ request }) => {
    const { serialNumber, firmwareVersion } =
      new MeterBuilder().build();

    const response = await request.post('/api/meters', {
      data: {
        serialNumber,
        firmwareVersion,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects an unknown meter status', async ({ request }) => {
    const payload = new MeterBuilder().build();

    const response = await request.post('/api/meters', {
      data: {
        ...payload,
        status: 'DISCONNECTED',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects a duplicate serial number without changing the original meter', async ({
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

    const getResponse = await meterApi.getMeterById(created.id);

    expect(getResponse.status()).toBe(200);

    const retrieved: unknown = await getResponse.json();

    expect(retrieved).toEqual(created);
  });
});