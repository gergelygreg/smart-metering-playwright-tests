import { randomUUID } from 'node:crypto';
import { connect, type MqttClient } from 'mqtt';
import { expect, type APIRequestContext } from '@playwright/test';

export interface TestMeter {
  id: string;
  serialNumber: string;
  status: 'ONLINE' | 'OFFLINE' | 'FAULT' | 'MAINTENANCE';
  firmwareVersion: string;
}

export interface TelemetryOverrides {
  messageId?: string;
  voltage?: number;
  current?: number;
  activePower?: number;
  energyKwh?: number;
  sequence?: number;
}

export function uniqueSerial(prefix = 'MQTT'): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
}

export async function createMeter(
  request: APIRequestContext,
  serialNumber = uniqueSerial(),
): Promise<TestMeter> {
  const response = await request.post('/api/meters', {
    data: {
      serialNumber,
      status: 'ONLINE',
      firmwareVersion: 'mqtt-test-1.0.0',
    },
  });

  expect(response.status()).toBe(201);
  return (await response.json()) as TestMeter;
}

export async function deleteMeter(
  request: APIRequestContext,
  meterId: string,
): Promise<void> {
  const response = await request.delete(`/api/meters/${meterId}`);
  expect([204, 404]).toContain(response.status());
}

export function buildTelemetry(
  meter: TestMeter,
  overrides: TelemetryOverrides = {},
) {
  const voltage = overrides.voltage ?? 230;
  const current = overrides.current ?? 4.2;

  return {
    messageId: overrides.messageId ?? randomUUID(),
    meterId: meter.id,
    serialNumber: meter.serialNumber,
    firmwareVersion: meter.firmwareVersion,
    timestamp: new Date().toISOString(),
    voltage,
    current,
    activePower:
      overrides.activePower ??
      Number((voltage * current * 0.95).toFixed(3)),
    energyKwh: overrides.energyKwh ?? 12543.8,
    sequence: overrides.sequence ?? 1,
    source: 'smart-meter-device-simulator',
  } as const;
}

export async function publishTelemetry(
  meterId: string,
  telemetry: unknown,
): Promise<void> {
  const mqttUrl =
    process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';

  const client = await connectClient(mqttUrl);

  try {
    await publish(
      client,
      `smart-metering/meters/${meterId}/telemetry`,
      JSON.stringify(telemetry),
    );
  } finally {
    await closeClient(client);
  }
}

async function connectClient(
  mqttUrl: string,
): Promise<MqttClient> {
  return await new Promise<MqttClient>((resolve, reject) => {
    const client = connect(mqttUrl, {
      clientId: `playwright-mqtt-${randomUUID()}`,
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: 5_000,
    });

    const onError = (error: Error) => {
      client.removeListener('connect', onConnect);
      reject(error);
    };

    const onConnect = () => {
      client.removeListener('error', onError);
      resolve(client);
    };

    client.once('error', onError);
    client.once('connect', onConnect);
  });
}

async function publish(
  client: MqttClient,
  topic: string,
  payload: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    client.publish(
      topic,
      payload,
      { qos: 1, retain: false },
      (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
}

async function closeClient(
  client: MqttClient,
): Promise<void> {
  await new Promise<void>((resolve) => {
    client.end(false, {}, () => resolve());
  });
}