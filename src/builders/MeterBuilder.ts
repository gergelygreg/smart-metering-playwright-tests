import { randomUUID } from 'node:crypto';

import type {
  CreateMeterRequest,
  MeterStatus,
} from '../models/meter.js';

export class MeterBuilder {
  constructor(
    private readonly overrides: Partial<CreateMeterRequest> = {},
  ) {}

  withSerialNumber(serialNumber: string): MeterBuilder {
    return new MeterBuilder({
      ...this.overrides,
      serialNumber,
    });
  }

  withStatus(status: MeterStatus): MeterBuilder {
    return new MeterBuilder({
      ...this.overrides,
      status,
    });
  }

  withFirmwareVersion(firmwareVersion: string): MeterBuilder {
    return new MeterBuilder({
      ...this.overrides,
      firmwareVersion,
    });
  }

  build(): CreateMeterRequest {
    return {
      serialNumber: `SN-TEST-${randomUUID()}`,
      status: 'ONLINE',
      firmwareVersion: '1.0.0',
      ...this.overrides,
    };
  }
}