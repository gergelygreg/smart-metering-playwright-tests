import { connect } from 'mqtt';
import { HttpBackendClient } from './backend-client.js';
import { startHealthServer } from './health-server.js';
import { TelemetryHandler } from './telemetry-handler.js';

const mqttUrl = process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:18080';
const healthPort = Number(process.env.HEALTH_PORT ?? '8090');
const topicFilter = 'smart-metering/meters/+/telemetry';

const backend = new HttpBackendClient(apiBaseUrl);
const handler = new TelemetryHandler(backend);

let mqttConnected = false;

const client = connect(mqttUrl, {
  clientId: `smart-metering-ingestion-${process.pid}`,
  clean: true,
  reconnectPeriod: 2_000,
  connectTimeout: 10_000,
});

startHealthServer(healthPort, {
  isMqttConnected: () => mqttConnected,
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
        event: 'telemetry-ingestion-failed',
        topic,
        message:
          error instanceof Error ? error.message : String(error),
      }),
    );
  });
});

function shutdown(signal: string): void {
  console.log(JSON.stringify({ event: 'shutdown', signal }));

  client.end(true, () => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));