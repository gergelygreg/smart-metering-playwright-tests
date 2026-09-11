import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('device simulator configuration', () => {
  it('loads explicit simulator settings', () => {
    const config = loadConfig({
      MQTT_URL: 'mqtt://broker:1883',
      API_BASE_URL: 'http://api:8080',
      SIM_SERIAL_NUMBER: 'SIM-EXPLICIT',
      SIM_FIRMWARE_VERSION: 'sim-2.0.0',
      SIM_PROFILE: 'mixed',
      SIM_COUNT: '4',
      SIM_INTERVAL_MS: '250',
      SIM_INITIAL_ENERGY_KWH: '99.5',
    });

    expect(config).toMatchObject({
      mqttUrl: 'mqtt://broker:1883',
      apiBaseUrl: 'http://api:8080',
      serialNumber: 'SIM-EXPLICIT',
      firmwareVersion: 'sim-2.0.0',
      profile: 'mixed',
      count: 4,
      intervalMs: 250,
      initialEnergyKwh: 99.5,
    });
  });

  it('rejects an unsupported profile', () => {
    expect(() =>
      loadConfig({
        SIM_PROFILE: 'broken',
      }),
    ).toThrow('Unsupported SIM_PROFILE');
  });
});