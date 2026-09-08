import { test, expect } from '@playwright/test';

import { MeterBuilder } from '../../src/builders/MeterBuilder.js';

test.describe('MeterBuilder', () => {
  test('creates valid default meter payloads with unique serial numbers', () => {
    const builder = new MeterBuilder();

    const first = builder.build();
    const second = builder.build();

    expect(first).toEqual({
      serialNumber: expect.stringMatching(/^SN-TEST-[0-9a-f-]+$/),
      status: 'ONLINE',
      firmwareVersion: '1.0.0',
    });

    expect(second.serialNumber).not.toBe(first.serialNumber);
  });

  test('allows individual fields to be overridden', () => {
    const payload = new MeterBuilder()
      .withSerialNumber('SN-CUSTOM-001')
      .withStatus('OFFLINE')
      .withFirmwareVersion('2.3.0')
      .build();

    expect(payload).toEqual({
      serialNumber: 'SN-CUSTOM-001',
      status: 'OFFLINE',
      firmwareVersion: '2.3.0',
    });
  });

  test('does not mutate the original builder', () => {
    const original = new MeterBuilder();
    const modified = original.withStatus('MAINTENANCE');

    expect(original.build().status).toBe('ONLINE');
    expect(modified.build().status).toBe('MAINTENANCE');
  });
});