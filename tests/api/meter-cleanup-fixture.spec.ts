import { test, expect } from '../../src/fixtures/api-fixtures.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';

let createdMeterId = '';

test.describe('Automatic meter cleanup fixture @api', () => {
  test.describe.configure({ mode: 'serial' });

  test('tracks a created meter until test teardown', async ({
    meterApi,
  }) => {
    const payload = new MeterBuilder().build();

    const createResponse = await meterApi.createMeter(payload);

    expect(createResponse.status()).toBe(201);

    const location = createResponse.headers()['location'];

    expect(location).toMatch(/^\/api\/meters\/.+$/);

    if (!location) {
      throw new Error('Created meter has no Location header.');
    }

    createdMeterId = location.substring('/api/meters/'.length);

    const getResponse = await meterApi.getMeterById(createdMeterId);

    expect(getResponse.status()).toBe(200);
  });

  test('removes the previous test meter during fixture teardown', async ({
    meterApi,
  }) => {
    expect(createdMeterId).not.toBe('');

    const response = await meterApi.getMeterById(createdMeterId);

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain(
      'application/problem+json',
    );

    const problem: unknown = await response.json();

    expect(problem).toMatchObject({
      status: 404,
      code: 'METER_NOT_FOUND',
      instance: `/api/meters/${createdMeterId}`,
    });
  });
});
