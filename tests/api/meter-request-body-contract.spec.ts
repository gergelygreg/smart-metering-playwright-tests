import { test, expect } from '../../src/fixtures/api-fixtures.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';
import type { ApiProblem } from '../../src/models/api-error.js';

type ProblemContract = Pick<
  ApiProblem,
  'type' | 'title' | 'status' | 'detail' | 'instance' | 'code'
>;

const invalidBodies = [
  {
    name: 'malformed JSON syntax',
    makeBody: (serialNumber: string): string =>
      `{"serialNumber":"${serialNumber}","status":"ONLINE",`,
  },
  {
    name: 'unknown meter status',
    makeBody: (serialNumber: string): string =>
      JSON.stringify({
        serialNumber,
        status: 'DISCONNECTED',
        firmwareVersion: '1.0.0',
      }),
  },
  {
    name: 'invalid firmware version type',
    makeBody: (serialNumber: string): string =>
      JSON.stringify({
        serialNumber,
        status: 'ONLINE',
        firmwareVersion: 123,
      }),
  },
];

test.describe('Meter request body error contracts @api', () => {
  for (const scenario of invalidBodies) {
    test(`rejects ${scenario.name} with a structured problem`, async ({
      request,
    }) => {
      const { serialNumber } = new MeterBuilder().build();

      const response = await request.post('/api/meters', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: scenario.makeBody(serialNumber),
      });

      expect(response.status()).toBe(400);
      expect(response.headers()['content-type']).toContain(
        'application/problem+json',
      );

      const body: unknown = await response.json();

      const expected: ProblemContract = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Request body is invalid.',
        instance: '/api/meters',
        code: 'INVALID_REQUEST_BODY',
      };

      expect(body).toMatchObject(expected);
    });
  }
});