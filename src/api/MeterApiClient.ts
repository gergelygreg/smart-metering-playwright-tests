import type {
  APIRequestContext,
  APIResponse,
} from '@playwright/test';

import type {
  CreateMeterRequest,
} from '../models/meter.js';

export class MeterApiClient {
  private readonly basePath = '/api/meters';

  constructor(
    private readonly request: APIRequestContext,
  ) {}

  async createMeter(
    payload: CreateMeterRequest,
  ): Promise<APIResponse> {
    return this.request.post(this.basePath, {
      data: payload,
    });
  }

  async getMeterById(
    id: string,
  ): Promise<APIResponse> {
    return this.request.get(
      `${this.basePath}/${encodeURIComponent(id)}`,
    );
  }
}