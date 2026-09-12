import { connect } from 'mqtt';
import { startHealthServer } from './health-server.js';
import { KafkaTelemetryPublisher } from './kafka-publisher.js';
import { TelemetryHandler } from './telemetry-handler.js';

const mqttUrl =
  process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';

const kafkaBrokers = (
  process.env.KAFKA_BROKERS ?? '127.0.0.1:29092'
)
  .split(',')
  .map((broker) => broker.trim())
  .filter(Boolean);

const healthPort = Number(process.env.HEALTH_PORT ?? '8090');
const topicFilter = 'smart-metering/meters/+/telemetry';

const publisher = new KafkaTelemetryPublisher(kafkaBrokers);
await publisher.connect();

const handler = new TelemetryHandler(publisher);
let mqttConnected = false;

const client = connect(mqttUrl, {
  clientId: `smart-metering-ingestion-${process.pid}`,
  clean: true,
  reconnectPeriod: 2_000,
  connectTimeout: 10_000,
});

startHealthServer(healthPort, {
  isMqttConnected: () => mqttConnected,
  isKafkaConnected: () => publisher.isConnected(),
  metrics: () => handler.metrics,
});

client.on('connect', () => {
  mqttConnected = true;
  client.subscribe(topicFilter, { qos: 1 }, (error) => {
    if (error) {
      console.error(
        JSON.stringify({
          event: 'mqtt-subscribe-failed',
          message: error.message,
        }),
      );
      return;
    }

    console.log(
      JSON.stringify({
        event: 'mqtt-subscribed',
        broker: mqttUrl,
        topic: topicFilter,
        kafkaBrokers,
      }),
    );
  });
});

client.on('reconnect', () => {
  mqttConnected = false;
});
client.on('offline', () => {
  mqttConnected = false;
});
client.on('close', () => {
  mqttConnected = false;
});
client.on('error', (error) => {
  console.error(
    JSON.stringify({
      event: 'mqtt-error',
      message: error.message,
    }),
  );
});

client.on('message', (topic, payload) => {
  void handler.handle(topic, payload).catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'telemetry-kafka-publish-failed',
        topic,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  });
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(JSON.stringify({ event: 'shutdown', signal }));
  client.end(true);

  try {
    await publisher.disconnect();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
