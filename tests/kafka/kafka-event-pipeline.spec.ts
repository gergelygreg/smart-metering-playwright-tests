import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  createMeter,
  deleteMeter,
} from '../mqtt/mqtt-test-helper';
import {
  buildTelemetryEvent,
  fetchAuditEvents,
  publishTelemetryEvent,
} from './kafka-test-helper';

test.describe('Kafka event-driven pipeline @kafka', () => {
  test('telemetry event becomes a persisted reading and downstream event', async ({
    request,
  }) => {
    const meter = await createMeter(request);
    const correlationId = randomUUID();

    try {
      await publishTelemetryEvent(
        buildTelemetryEvent(meter, { correlationId }),
        meter.id,
      );

      await expect
        .poll(async () => {
          const response = await request.get(
            `/api/meters/${meter.id}/readings`,
          );
          return ((await response.json()) as unknown[]).length;
        })
        .toBe(1);

      await expect
        .poll(async () => {
          const events = await fetchAuditEvents({
            correlationId,
            eventType: 'smart-metering.reading.persisted',
          });
          return events.length;
        })
        .toBe(1);
    } finally {
      await deleteMeter(request, meter.id);
    }
  });

  test('high voltage creates alarm and alarm-created event', async ({
    request,
  }) => {
    const meter = await createMeter(request);
    const correlationId = randomUUID();

    try {
      await publishTelemetryEvent(
        buildTelemetryEvent(meter, {
          correlationId,
          voltage: 260,
          activePower: 1037.4,
        }),
        meter.id,
      );

      await expect
        .poll(async () => {
          const response = await request.get(
            `/api/meters/${meter.id}/alarms`,
          );
          return ((await response.json()) as unknown[]).length;
        })
        .toBe(1);

      await expect
        .poll(async () => {
          const events = await fetchAuditEvents({
            correlationId,
            eventType: 'smart-metering.alarm.created',
          });
          return events.length;
        })
        .toBe(1);
    } finally {
      await deleteMeter(request, meter.id);
    }
  });

  test('duplicate Kafka event id is processed once', async ({
    request,
  }) => {
    const meter = await createMeter(request);
    const eventId = randomUUID();
    const event = buildTelemetryEvent(meter, { eventId });

    try {
      await publishTelemetryEvent(event, meter.id);
      await publishTelemetryEvent(event, meter.id);

      await expect
        .poll(async () => {
          const response = await request.get(
            `/api/meters/${meter.id}/readings`,
          );
          return ((await response.json()) as unknown[]).length;
        })
        .toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 750));

      const response = await request.get(
        `/api/meters/${meter.id}/readings`,
      );
      expect((await response.json()) as unknown[]).toHaveLength(1);
    } finally {
      await deleteMeter(request, meter.id);
    }
  });

  test('invalid Kafka event is rejected', async ({ request }) => {
    const meter = await createMeter(request);

    try {
      await publishTelemetryEvent(
        {
          eventId: randomUUID(),
          eventType: 'smart-metering.telemetry.received',
          eventVersion: 999,
          meterId: meter.id,
          payload: {},
        },
        meter.id,
      );

      await new Promise((resolve) => setTimeout(resolve, 750));

      const response = await request.get(
        `/api/meters/${meter.id}/readings`,
      );
      expect(await response.json()).toEqual([]);
    } finally {
      await deleteMeter(request, meter.id);
    }
  });

  test('same meter key preserves source sequence order', async ({
    request,
  }) => {
    const meter = await createMeter(request);

    try {
      await publishTelemetryEvent(
        buildTelemetryEvent(meter, {
          sequence: 1,
          energyKwh: 12543.8,
        }),
        meter.id,
      );
      await publishTelemetryEvent(
        buildTelemetryEvent(meter, {
          sequence: 2,
          energyKwh: 12543.9,
        }),
        meter.id,
      );

      await expect
        .poll(async () => {
          const events = await fetchAuditEvents({
            meterId: meter.id,
            eventType: 'smart-metering.reading.persisted',
          });
          return events.length;
        })
        .toBe(2);

      const events = await fetchAuditEvents({
        meterId: meter.id,
        eventType: 'smart-metering.reading.persisted',
      });

      expect(
        events.map((item) => item.event.payload.sourceSequence),
      ).toEqual([1, 2]);
    } finally {
      await deleteMeter(request, meter.id);
    }
  });
});
