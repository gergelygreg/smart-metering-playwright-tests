import type { SimulatorProfile } from './profiles.js';

export interface SimulatorConfig {
  mqttUrl: string;
  apiBaseUrl: string;
  serialNumber: string;
  firmwareVersion: string;
  profile: SimulatorProfile;
  count: number;
  intervalMs: number;
  initialEnergyKwh: number;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): SimulatorConfig {
  const profile = env.SIM_PROFILE ?? 'normal';

  if (
    profile !== 'normal' &&
    profile !== 'high-voltage' &&
    profile !== 'mixed'
  ) {
    throw new Error(
      `Unsupported SIM_PROFILE: ${profile}`,
    );
  }

  const count = parsePositiveInteger(
    env.SIM_COUNT ?? '10',
    'SIM_COUNT',
  );

  const intervalMs = parsePositiveInteger(
    env.SIM_INTERVAL_MS ?? '1000',
    'SIM_INTERVAL_MS',
  );

  const initialEnergyKwh = Number(
    env.SIM_INITIAL_ENERGY_KWH ?? '12500',
  );

  if (
    !Number.isFinite(initialEnergyKwh) ||
    initialEnergyKwh < 0
  ) {
    throw new Error(
      'SIM_INITIAL_ENERGY_KWH must be a non-negative number.',
    );
  }

  return {
    mqttUrl:
      env.MQTT_URL ?? 'mqtt://127.0.0.1:1883',
    apiBaseUrl:
      env.API_BASE_URL ?? 'http://127.0.0.1:18080',
    serialNumber:
      env.SIM_SERIAL_NUMBER ??
      `SIM-${Date.now()}`,
    firmwareVersion:
      env.SIM_FIRMWARE_VERSION ?? 'sim-1.0.0',
    profile,
    count,
    intervalMs,
    initialEnergyKwh,
  };
}

function parsePositiveInteger(
  raw: string,
  name: string,
): number {
  const value = Number(raw);

  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `${name} must be a positive integer.`,
    );
  }

  return value;
}