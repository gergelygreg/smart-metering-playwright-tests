import { describe, expect, it } from 'vitest';
import { generateTelemetry } from './telemetry.js';

describe('smart-meter telemetry generation', () => {
  it('creates a transport-ready message with monotonically increasing energy', () => {
    const first = generateTelemetry({
      meterId: 'd2719db7-013b-4bb0-a56d-3793dc6be90f',
      serialNumber: 'SIM-0001',
      firmwareVersion: 'sim-1.0.0',
      profile: 'normal',
      sequence: 1,
      intervalMs: 1000,
      previousEnergyKwh: 12500,
      timestamp: new Date('2026-09-11T12:00:00Z'),
    });

    expect(first.messageId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(first.energyKwh).toBeGreaterThan(12500);
    expect(first.source).toBe('smart-meter-device-simulator');
  });
});