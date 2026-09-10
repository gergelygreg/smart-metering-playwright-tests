import { test, expect } from '@playwright/test';

import { ReadingBuilder } from '../../src/builders/ReadingBuilder.js';

test.describe('ReadingBuilder', () => {
  test('creates a valid default reading payload', () => {
    const payload = new ReadingBuilder().build();

    expect(payload).toEqual({
      timestamp: '2026-01-01T12:00:00Z',
      voltage: 230.0,
      current: 4.2,
      activePower: 966.0,
      energyKwh: 12543.8,
    });
  });

  test('allows reading fields to be overridden', () => {
    const payload = new ReadingBuilder()
      .withTimestamp('2026-02-01T10:30:00Z')
      .withVoltage(228.5)
      .withCurrent(5.1)
      .withActivePower(1165.4)
      .withEnergyKwh(13000.2)
      .build();

    expect(payload).toEqual({
      timestamp: '2026-02-01T10:30:00Z',
      voltage: 228.5,
      current: 5.1,
      activePower: 1165.4,
      energyKwh: 13000.2,
    });
  });

  test('does not mutate the original builder', () => {
    const original = new ReadingBuilder();
    const modified = original.withVoltage(240.0);

    expect(original.build().voltage).toBe(230.0);
    expect(modified.build().voltage).toBe(240.0);
  });
});
