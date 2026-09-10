import { APIRequestContext, expect } from '@playwright/test';

export interface TestMeter {
  id: string;
  serialNumber: string;
  status: 'ONLINE' | 'OFFLINE' | 'FAULT' | 'MAINTENANCE';
  firmwareVersion: string;
}

function apiBaseUrl(): string {
  return (
    process.env.UI_API_BASE_URL ??
    process.env.API_BASE_URL ??
    'http://127.0.0.1:18080'
  ).replace(/\/$/, '');
}

function apiUrl(path: string): string {
  return `${apiBaseUrl()}${path}`;
}

export function uniqueSerial(prefix = 'UI'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function createMeterViaApi(
  request: APIRequestContext,
  overrides: Partial<Omit<TestMeter, 'id'>> = {},
): Promise<TestMeter> {
  const response = await request.post(apiUrl('/api/meters'), {
    data: {
      serialNumber: uniqueSerial('API'),
      status: 'ONLINE',
      firmwareVersion: '2.0.0',
      ...overrides,
    },
  });

  const responseBody = await response.text();

  expect(
    response.status(),
    `Direct backend meter creation failed: ${response.status()} ${responseBody}`,
  ).toBe(201);

  return JSON.parse(responseBody) as TestMeter;
}

export async function findMeterBySerial(
  request: APIRequestContext,
  serialNumber: string,
): Promise<TestMeter | undefined> {
  const response = await request.get(apiUrl('/api/meters'));
  const responseBody = await response.text();

  expect(
    response.status(),
    `Direct backend meter list failed: ${response.status()} ${responseBody}`,
  ).toBe(200);

  const meters = JSON.parse(responseBody) as TestMeter[];
  return meters.find((meter) => meter.serialNumber === serialNumber);
}

export async function deleteMeterIfExists(
  request: APIRequestContext,
  meterId: string | undefined,
): Promise<void> {
  if (!meterId) {
    return;
  }

  const response = await request.delete(apiUrl(`/api/meters/${meterId}`));
  const responseBody = await response.text();

  expect(
    [204, 404],
    `Direct backend cleanup failed: ${response.status()} ${responseBody}`,
  ).toContain(response.status());
}