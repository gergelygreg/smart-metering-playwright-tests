import type {
  APIRequestContext,
  APIResponse,
} from '@playwright/test';

import { MeterApiClient } from '../api/MeterApiClient.js';
import type { CreateMeterRequest } from '../models/meter.js';

export class TrackedMeterApiClient extends MeterApiClient {
  private readonly createdMeterIds = new Set<string>();

  constructor(request: APIRequestContext) {
    super(request);
  }

  override async createMeter(
    payload: CreateMeterRequest,
  ): Promise<APIResponse> {
    const response = await super.createMeter(payload);

    if (response.status() === 201) {
      const location = response.headers()['location'];
      const prefix = '/api/meters/';

      if (!location?.startsWith(prefix)) {
        throw new Error(
          'Created meter response did not contain a valid Location header.',
        );
      }

      const meterId = location.substring(prefix.length);

      if (!meterId) {
        throw new Error(
          'Created meter Location header did not contain an ID.',
        );
      }

      this.createdMeterIds.add(meterId);
    }

    return response;
  }

  override async deleteMeter(
    id: string,
  ): Promise<APIResponse> {
    const response = await super.deleteMeter(id);

    if (response.status() === 204 || response.status() === 404) {
      this.createdMeterIds.delete(id);
    }

    return response;
  }

  async cleanupCreatedMeters(): Promise<void> {
    const failures: string[] = [];

    for (const meterId of [...this.createdMeterIds].reverse()) {
      try {
        const response = await super.deleteMeter(meterId);

        if (
          response.status() !== 204 &&
          response.status() !== 404
        ) {
          failures.push(
            `${meterId}: unexpected cleanup status ${response.status()}`,
          );
        }
      } catch (error) {
        failures.push(
          `${meterId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.createdMeterIds.clear();

    if (failures.length > 0) {
      throw new Error(
        `Meter cleanup failed:\n${failures.join('\n')}`,
      );
    }
  }
}
