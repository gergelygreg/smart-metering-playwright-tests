import { randomUUID } from 'node:crypto';

import { test, expect } from '../../src/fixtures/api-fixtures.js';
import type { MeterApiClient } from '../../src/api/MeterApiClient.js';
import type { AlarmApiClient } from '../../src/api/AlarmApiClient.js';
import type { ReadingApiClient } from '../../src/api/ReadingApiClient.js';
import { MeterBuilder } from '../../src/builders/MeterBuilder.js';
import { ReadingBuilder } from '../../src/builders/ReadingBuilder.js';
import type { AlarmResponse } from '../../src/models/alarm.js';

async function createMeter(meterApi: MeterApiClient): Promise<string> {
  const response = await meterApi.createMeter(new MeterBuilder().build());
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'string') {
    throw new Error('The created meter response has no valid ID.');
  }
  return body.id;
}

async function createHighVoltageAlarm(
  meterId: string,
  readingApi: ReadingApiClient,
  alarmApi: AlarmApiClient,
): Promise<AlarmResponse> {
  const readingResponse = await readingApi.createReading(
    meterId,
    new ReadingBuilder().withVoltage(260.0).build(),
  );
  expect(readingResponse.status()).toBe(201);
  const reading: unknown = await readingResponse.json();
  if (typeof reading !== 'object' || reading === null || !('id' in reading) || typeof reading.id !== 'string') {
    throw new Error('The created reading response has no valid ID.');
  }

  const alarmsResponse = await alarmApi.getAlarms(meterId);
  expect(alarmsResponse.status()).toBe(200);
  const alarms: unknown = await alarmsResponse.json();
  if (!Array.isArray(alarms) || alarms.length !== 1) {
    throw new Error(`Expected one generated alarm, received ${JSON.stringify(alarms)}`);
  }
  const alarm = alarms[0] as Partial<AlarmResponse>;
  if (typeof alarm.id !== 'string' || alarm.sourceReadingId !== reading.id) {
    throw new Error('Generated alarm is invalid or not linked to reading.');
  }
  return alarm as AlarmResponse;
}

test.describe('Meter alarm contracts @api', () => {
  test('normal voltage reading does not create an alarm', async ({ meterApi, readingApi, alarmApi }) => {
    const meterId = await createMeter(meterApi);
    const readingResponse = await readingApi.createReading(
      meterId,
      new ReadingBuilder().withVoltage(230.0).build(),
    );
    expect(readingResponse.status()).toBe(201);
    const response = await alarmApi.getAlarms(meterId);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test('high voltage reading creates a retrievable alarm', async ({ meterApi, readingApi, alarmApi }) => {
    const meterId = await createMeter(meterApi);
    const alarm = await createHighVoltageAlarm(meterId, readingApi, alarmApi);
    expect(alarm).toMatchObject({
      meterId,
      type: 'HIGH_VOLTAGE',
      severity: 'WARNING',
      status: 'ACTIVE',
      actualValue: 260,
      threshold: 253,
      acknowledgedAt: null,
    });
    const response = await alarmApi.getAlarm(meterId, alarm.id);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(alarm);
  });

  test('unknown alarm returns structured not found problem', async ({ meterApi, alarmApi }) => {
    const meterId = await createMeter(meterApi);
    const alarmId = randomUUID();
    const response = await alarmApi.getAlarm(meterId, alarmId);
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/problem+json');
    expect(await response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Meter alarm not found.',
      code: 'ALARM_NOT_FOUND',
      instance: `/api/meters/${meterId}/alarms/${alarmId}`,
    });
  });

  test('does not expose an alarm through another meter', async ({ meterApi, readingApi, alarmApi }) => {
    const ownerMeterId = await createMeter(meterApi);
    const otherMeterId = await createMeter(meterApi);
    const alarm = await createHighVoltageAlarm(ownerMeterId, readingApi, alarmApi);
    const response = await alarmApi.getAlarm(otherMeterId, alarm.id);
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({
      code: 'ALARM_NOT_FOUND',
      instance: `/api/meters/${otherMeterId}/alarms/${alarm.id}`,
    });
  });

  test('acknowledges an alarm idempotently', async ({ meterApi, readingApi, alarmApi }) => {
    const meterId = await createMeter(meterApi);
    const alarm = await createHighVoltageAlarm(meterId, readingApi, alarmApi);
    const firstResponse = await alarmApi.acknowledgeAlarm(meterId, alarm.id);
    expect(firstResponse.status()).toBe(200);
    const first: unknown = await firstResponse.json();
    expect(first).toMatchObject({ id: alarm.id, meterId, status: 'ACKNOWLEDGED' });
    if (typeof first !== 'object' || first === null || !('acknowledgedAt' in first) || typeof first.acknowledgedAt !== 'string') {
      throw new Error('Acknowledged alarm has no acknowledgedAt timestamp.');
    }
    const secondResponse = await alarmApi.acknowledgeAlarm(meterId, alarm.id);
    expect(secondResponse.status()).toBe(200);
    expect(await secondResponse.json()).toMatchObject({
      id: alarm.id,
      status: 'ACKNOWLEDGED',
      acknowledgedAt: first.acknowledgedAt,
    });
  });
});
