import { randomUUID } from 'node:crypto';
import {
  activePowerFor,
  currentFor,
  type SimulatorProfile,
  voltageFor,
} from './profiles.js';

export interface TelemetryMessage {
  messageId: string;
  meterId: string;
  serialNumber: string;
  firmwareVersion: string;
  timestamp: string;
  voltage: number;
  current: number;
  activePower: number;
  energyKwh: number;
  sequence: number;
  source: 'smart-meter-device-simulator';
}

export interface GenerateTelemetryOptions {
  meterId: string;
  serialNumber: string;
  firmwareVersion: string;
  profile: SimulatorProfile;
  sequence: number;
  intervalMs: number;
  previousEnergyKwh: number;
  timestamp?: Date;
}

export function generateTelemetry(
  options: GenerateTelemetryOptions,
): TelemetryMessage {
  const voltage = voltageFor(
    options.profile,
    options.sequence,
  );

  const current = currentFor(options.sequence);
  const activePower = activePowerFor(voltage, current);

  const intervalHours =
    options.intervalMs / 1000 / 60 / 60;

  const consumedKwh =
    Math.max(activePower, 0) / 1000 * intervalHours;

  return {
    messageId: randomUUID(),
    meterId: options.meterId,
    serialNumber: options.serialNumber,
    firmwareVersion: options.firmwareVersion,
    timestamp:
      options.timestamp?.toISOString() ??
      new Date().toISOString(),
    voltage,
    current,
    activePower,
    energyKwh: Number(
      (options.previousEnergyKwh + consumedKwh).toFixed(6),
    ),
    sequence: options.sequence,
    source: 'smart-meter-device-simulator',
  };
}