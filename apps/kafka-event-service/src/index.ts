import {
  Kafka,
  logLevel,
  type Consumer,
} from 'kafkajs';
import { AuditHandler } from './audit-handler.js';
import { HttpBackendClient } from './backend-client.js';
import {
  ALARM_TOPIC,
  READING_TOPIC,
  TELEMETRY_TOPIC,
} from './contracts.js';
import { EventStore } from './event-store.js';
import { KafkaDomainEventPublisher } from './event-publisher.js';
import { startHttpServer } from './http-server.js';
import { TelemetryProcessor } from './processor.js';

const brokers = (
  process.env.KAFKA_BROKERS ?? '127.0.0.1:29092'
)
  .split(',')
  .map((broker) => broker.trim())
  .filter(Boolean);

const apiBaseUrl =
  process.env.API_BASE_URL ?? 'http://127.0.0.1:18080';
const healthPort = Number(process.env.HEALTH_PORT ?? '8100');

const kafka = new Kafka({
  clientId: 'smart-metering-kafka-event-service',
  brokers,
  logLevel: logLevel.NOTHING,
});

const processorConsumer: Consumer = kafka.consumer({
  groupId: 'smart-metering-telemetry-processor-v1',
  allowAutoTopicCreation: false,
});

const auditConsumer: Consumer = kafka.consumer({
  groupId: 'smart-metering-event-audit-v1',
  allowAutoTopicCreation: false,
});

const publisher = new KafkaDomainEventPublisher(brokers);
const backend = new HttpBackendClient(apiBaseUrl);
const processor = new TelemetryProcessor(backend, publisher);
const store = new EventStore(500);
const audit = new AuditHandler(store);

let processorConnected = false;
let auditConnected = false;

await publisher.connect();

await processorConsumer.connect();
processorConnected = true;
await processorConsumer.subscribe({
  topic: TELEMETRY_TOPIC,
  fromBeginning: false,
});

await auditConsumer.connect();
auditConnected = true;
await auditConsumer.subscribe({
  topics: [READING_TOPIC, ALARM_TOPIC],
  fromBeginning: false,
});

startHttpServer(
  healthPort,
  {
    isProcessorConnected: () => processorConnected,
    isAuditConnected: () => auditConnected,
    isProducerConnected: () => publisher.isConnected(),
    processorMetrics: () => processor.metrics,
  },
  audit,
  store,
);

void processorConsumer
  .run({
    eachMessage: async ({ message }) => {
      if (message.value) {
        await processor.handle(message.value);
      }
    },
  })
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'telemetry-consumer-failed',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  });

void auditConsumer
  .run({
    eachMessage: async ({ topic, partition, message }) => {
      if (message.value) {
        audit.handle(
          topic,
          partition,
          message.offset,
          message.value,
        );
      }
    },
  })
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'audit-consumer-failed',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  });

console.log(
  JSON.stringify({
    event: 'kafka-event-service-started',
    brokers,
    telemetryTopic: TELEMETRY_TOPIC,
    domainTopics: [READING_TOPIC, ALARM_TOPIC],
  }),
);

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  processorConnected = false;
  auditConnected = false;

  console.log(JSON.stringify({ event: 'shutdown', signal }));

  await Promise.allSettled([
    processorConsumer.disconnect(),
    auditConsumer.disconnect(),
    publisher.disconnect(),
  ]);

  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
