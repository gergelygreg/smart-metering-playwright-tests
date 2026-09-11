import { describe, expect, it } from 'vitest';
import {
  telemetrySchema,
  toReadingRequest,
} from './contracts.js';

describe('MQTT telemetry contract', () => {
  const telemetry = {
    messageId: 'fdd414e8-b36d-4659-a455-c07a29b06739',
    meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
    serialNumber: 'SIM-0001',
    firmwareVersion: 'sim-1.0.0',
    timestamp: '2026-09-11T12:00:00.000Z',
    voltage: 230,
    current: 4.2,
    activePower: 917.7,
    energyKwh: 12543.8,
    sequence: 1,
    source: 'smart-meter-device-simulator' as const,
  };

  it('accepts a valid smart-meter telemetry message', () => {
    expect(telemetrySchema.safeParse(telemetry).success).toBe(true);
  });

  it('rejects an invalid voltage', () => {
    expect(
      telemetrySchema.safeParse({
        ...telemetry,
        voltage: 0,
      }).success,
    ).toBe(false);
  });

  it('maps transport telemetry to the existing backend reading contract', () => {
    expect(toReadingRequest(telemetry)).toEqual({
      timestamp: telemetry.timestamp,
      voltage: telemetry.voltage,
      current: telemetry.current,
      activePower: telemetry.activePower,
      energyKwh: telemetry.energyKwh,
    });
  });
});