import type {
  CreateReadingRequest,
} from '../models/reading.js';

export class ReadingBuilder {
  constructor(
    private readonly overrides: Partial<CreateReadingRequest> = {},
  ) {}

  withTimestamp(timestamp: string): ReadingBuilder {
    return new ReadingBuilder({
      ...this.overrides,
      timestamp,
    });
  }

  withVoltage(voltage: number): ReadingBuilder {
    return new ReadingBuilder({
      ...this.overrides,
      voltage,
    });
  }

  withCurrent(current: number): ReadingBuilder {
    return new ReadingBuilder({
      ...this.overrides,
      current,
    });
  }

  withActivePower(activePower: number): ReadingBuilder {
    return new ReadingBuilder({
      ...this.overrides,
      activePower,
    });
  }

  withEnergyKwh(energyKwh: number): ReadingBuilder {
    return new ReadingBuilder({
      ...this.overrides,
      energyKwh,
    });
  }

  build(): CreateReadingRequest {
    return {
      timestamp: '2026-01-01T12:00:00Z',
      voltage: 230.0,
      current: 4.2,
      activePower: 966.0,
      energyKwh: 12543.8,
      ...this.overrides,
    };
  }
}
