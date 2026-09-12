import { randomUUID } from 'node:crypto';
import {
  Kafka,
  logLevel,
  Partitioners,
  type Producer,
} from 'kafkajs';

export const TELEMETRY_TOPIC =
  'smart-metering.telemetry.received.v1';

export interface KafkaTestMeter {
  id: string;
  serialNumber: string;
  status: 'ONLINE' | 'OFFLINE' | 'FAULT' | 'MAINTENANCE';
  firmwareVersion: string;
}

export function buildTelemetryEvent(
  meter: KafkaTestMeter,
  options: {
    eventId?: string;
    correlationId?: string;
    sequence?: number;
    voltage?: number;
    activePower?: number;
    energyKwh?: number;
  } = {},
) {
  const voltage = options.voltage ?? 230;
  const current = 4.2;
  const correlationId = options.correlationId ?? randomUUID();

  return {
    eventId: options.eventId ?? randomUUID(),
    eventType: 'smart-metering.telemetry.received',
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId,
    meterId: meter.id,
    payload: {
      messageId: correlationId,
      meterId: meter.id,
      serialNumber: meter.serialNumber,
      firmwareVersion: meter.firmwareVersion,
      timestamp: new Date().toISOString(),
      voltage,
      current,
      activePower:
        options.activePower ??
        Number((voltage * current * 0.95).toFixed(3)),
      energyKwh: options.energyKwh ?? 12543.8,
      sequence: options.sequence ?? 1,
      source: 'smart-meter-device-simulator',
    },
  };
}

export async function withProducer<T>(
  action: (producer: Producer) => Promise<T>,
): Promise<T> {
  const kafka = new Kafka({
    clientId: `playwright-kafka-${randomUUID()}`,
    brokers: [
      process.env.KAFKA_BROKER ?? '127.0.0.1:29092',
    ],
    logLevel: logLevel.NOTHING,
  });

  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    allowAutoTopicCreation: false,
  });

  await producer.connect();

  try {
    return await action(producer);
  } finally {
    await producer.disconnect();
  }
}

export async function publishTelemetryEvent(
  event: unknown,
  meterId: string,
): Promise<void> {
  await withProducer(async (producer) => {
    await producer.send({
      topic: TELEMETRY_TOPIC,
      acks: -1,
      messages: [
        {
          key: meterId,
          value: JSON.stringify(event),
        },
      ],
    });
  });
}

export async function fetchAuditEvents(
  query: {
    correlationId?: string;
    meterId?: string;
    eventType?: string;
  } = {},
) {
  const base =
    process.env.KAFKA_EVENT_SERVICE_BASE_URL ??
    'http://127.0.0.1:18100';

  const url = new URL('/events', base);

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Kafka event service API failed: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as Array<{
    event: {
      eventId: string;
      eventType: string;
      correlationId: string;
      meterId: string;
      payload: Record<string, unknown>;
    };
  }>;
}
