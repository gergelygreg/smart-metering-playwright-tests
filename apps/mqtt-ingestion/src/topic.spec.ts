import { describe, expect, it } from 'vitest';
import {
  meterIdFromTelemetryTopic,
  telemetryTopicFor,
} from './topic.js';

describe('MQTT telemetry topic contract', () => {
  const meterId = 'd2719db7-013b-4bb0-a56d-3793dc6be90f';

  it('creates the canonical meter telemetry topic', () => {
    expect(telemetryTopicFor(meterId)).toBe(
      `smart-metering/meters/${meterId}/telemetry`,
    );
  });

  it('extracts meter id from a valid telemetry topic', () => {
    expect(
      meterIdFromTelemetryTopic(
        `smart-metering/meters/${meterId}/telemetry`,
      ),
    ).toBe(meterId);
  });

  it('rejects unrelated topics', () => {
    expect(
      meterIdFromTelemetryTopic(
        `smart-metering/meters/${meterId}/status`,
      ),
    ).toBeNull();
  });
});