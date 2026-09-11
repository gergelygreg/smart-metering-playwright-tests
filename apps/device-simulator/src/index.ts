import { ensureMeter } from './backend.js';
import { loadConfig } from './config.js';
import {
  closeClient,
  connectClient,
  publishMessage,
} from './mqtt.js';
import { generateTelemetry } from './telemetry.js';

const config = loadConfig();

const meter = await ensureMeter(
  config.apiBaseUrl,
  config.serialNumber,
  config.firmwareVersion,
);

const statusTopic =
  `smart-metering/meters/${meter.id}/status`;

const telemetryTopic =
  `smart-metering/meters/${meter.id}/telemetry`;

const offlinePayload = JSON.stringify({
  meterId: meter.id,
  serialNumber: meter.serialNumber,
  status: 'OFFLINE',
  timestamp: new Date().toISOString(),
});

const client = await connectClient(
  config.mqttUrl,
  {
    clientId: `meter-${meter.id}`,
    clean: true,
    reconnectPeriod: 1_000,
    connectTimeout: 10_000,
    will: {
      topic: statusTopic,
      payload: offlinePayload,
      qos: 1,
      retain: true,
    },
  },
);

await publishMessage(
  client,
  statusTopic,
  JSON.stringify({
    meterId: meter.id,
    serialNumber: meter.serialNumber,
    status: 'ONLINE',
    firmwareVersion: meter.firmwareVersion,
    timestamp: new Date().toISOString(),
  }),
  {
    qos: 1,
    retain: true,
  },
);

console.log(
  JSON.stringify({
    event: 'simulator-started',
    meterId: meter.id,
    serialNumber: meter.serialNumber,
    profile: config.profile,
    count: config.count,
    intervalMs: config.intervalMs,
  }),
);

let energyKwh = config.initialEnergyKwh;

for (
  let sequence = 1;
  sequence <= config.count;
  sequence += 1
) {
  const telemetry = generateTelemetry({
    meterId: meter.id,
    serialNumber: meter.serialNumber,
    firmwareVersion: meter.firmwareVersion,
    profile: config.profile,
    sequence,
    intervalMs: config.intervalMs,
    previousEnergyKwh: energyKwh,
  });

  energyKwh = telemetry.energyKwh;

  await publishMessage(
    client,
    telemetryTopic,
    JSON.stringify(telemetry),
    {
      qos: 1,
      retain: false,
    },
  );

  console.log(
    JSON.stringify({
      event: 'telemetry-published',
      sequence,
      messageId: telemetry.messageId,
      voltage: telemetry.voltage,
      energyKwh: telemetry.energyKwh,
    }),
  );

  if (sequence < config.count) {
    await new Promise((resolve) =>
      setTimeout(resolve, config.intervalMs),
    );
  }
}

await publishMessage(
  client,
  statusTopic,
  JSON.stringify({
    meterId: meter.id,
    serialNumber: meter.serialNumber,
    status: 'OFFLINE',
    timestamp: new Date().toISOString(),
  }),
  {
    qos: 1,
    retain: true,
  },
);

await closeClient(client);

console.log(
  JSON.stringify({
    event: 'simulator-completed',
    meterId: meter.id,
    serialNumber: meter.serialNumber,
    readingsPublished: config.count,
  }),
);