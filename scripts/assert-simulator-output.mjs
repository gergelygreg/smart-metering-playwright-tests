const apiBaseUrl =
  (process.env.API_BASE_URL ?? 'http://127.0.0.1:18080').replace(/\/$/, '');

const eventBaseUrl = process.env.KAFKA_EVENT_SERVICE_BASE_URL
  ? process.env.KAFKA_EVENT_SERVICE_BASE_URL.replace(/\/$/, '')
  : null;

const serialNumber = process.env.SIM_SERIAL_NUMBER;
const expectedReadings = Number(process.env.EXPECTED_READINGS ?? '4');
const expectAlarm =
  (process.env.EXPECT_ALARM ?? 'true').toLowerCase() === 'true';

if (!serialNumber) {
  throw new Error('SIM_SERIAL_NUMBER is required.');
}

async function getJson(path) {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(
      `${path} failed: ${response.status} ${await response.text()}`,
    );
  }

  return await response.json();
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${description}.`);
}

const meter = await waitFor(async () => {
  const meters = await getJson('/api/meters');
  return meters.find(
    (candidate) => candidate.serialNumber === serialNumber,
  );
}, `meter ${serialNumber}`);

const readings = await waitFor(async () => {
  const current = await getJson(`/api/meters/${meter.id}/readings`);
  return current.length >= expectedReadings ? current : null;
}, `${expectedReadings} readings`);

if (readings.length !== expectedReadings) {
  throw new Error(
    `Expected ${expectedReadings} readings, got ${readings.length}.`,
  );
}

const alarms = await getJson(`/api/meters/${meter.id}/alarms`);

if (expectAlarm && alarms.length < 1) {
  throw new Error('Expected at least one alarm from simulator telemetry.');
}

if (!expectAlarm && alarms.length !== 0) {
  throw new Error(`Expected no alarms, got ${alarms.length}.`);
}

let kafkaEvents = null;

if (eventBaseUrl) {
  kafkaEvents = await waitFor(async () => {
    const response = await fetch(
      `${eventBaseUrl}/events?meterId=${encodeURIComponent(meter.id)}`,
    );

    if (!response.ok) {
      return null;
    }

    const events = await response.json();
    const readingEvents = events.filter(
      (item) =>
        item.event.eventType === 'smart-metering.reading.persisted',
    );
    const alarmEvents = events.filter(
      (item) =>
        item.event.eventType === 'smart-metering.alarm.created',
    );

    const enoughReadings =
      readingEvents.length >= expectedReadings;
    const enoughAlarms = expectAlarm
      ? alarmEvents.length >= 1
      : alarmEvents.length === 0;

    return enoughReadings && enoughAlarms
      ? {
          total: events.length,
          readingEvents: readingEvents.length,
          alarmEvents: alarmEvents.length,
        }
      : null;
  }, 'Kafka downstream events');
}

console.log(
  JSON.stringify(
    {
      status: 'GREEN',
      meterId: meter.id,
      serialNumber,
      readings: readings.length,
      alarms: alarms.length,
      kafkaEvents,
    },
    null,
    2,
  ),
);

const deleteResponse = await fetch(
  `${apiBaseUrl}/api/meters/${meter.id}`,
  { method: 'DELETE' },
);

if (!deleteResponse.ok) {
  throw new Error(`Simulator cleanup failed: ${deleteResponse.status}`);
}
