import { describe, expect, it } from 'vitest';
import {
  activePowerFor,
  currentFor,
  voltageFor,
} from './profiles.js';

describe('smart-meter telemetry profiles', () => {
  it('keeps normal voltage below the lab alarm threshold', () => {
    for (let sequence = 1; sequence <= 20; sequence += 1) {
      expect(voltageFor('normal', sequence)).toBeLessThanOrEqual(253);
    }
  });

  it('keeps high-voltage profile above the alarm threshold', () => {
    for (let sequence = 1; sequence <= 20; sequence += 1) {
      expect(voltageFor('high-voltage', sequence)).toBeGreaterThan(253);
    }
  });

  it('mixed profile emits a high-voltage sample every fourth reading', () => {
    expect(voltageFor('mixed', 1)).toBeLessThanOrEqual(253);
    expect(voltageFor('mixed', 4)).toBeGreaterThan(253);
  });

  it('produces non-negative current', () => {
    expect(currentFor(1)).toBeGreaterThanOrEqual(0);
  });

  it('derives positive active power from voltage and current', () => {
    expect(activePowerFor(230, 4.2)).toBeGreaterThan(0);
  });
});