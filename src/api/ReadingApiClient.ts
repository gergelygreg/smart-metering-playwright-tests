import type {
  APIRequestContext,
  APIResponse,
} from '@playwright/test';

import type {
  CreateReadingRequest,
} from '../models/reading.js';

export class ReadingApiClient {
  constructor(
    private readonly request: APIRequestContext,
  ) {}

  async createReading(
    meterId: string,
    payload: CreateReadingRequest,
  ): Promise<APIResponse> {
    return this.request.post(
      `/api/meters/${encodeURIComponent(meterId)}/readings`,
      {
        data: payload,
      },
    );
  }

  async getReadings(
    meterId: string,
  ): Promise<APIResponse> {
    return this.request.get(
      `/api/meters/${encodeURIComponent(meterId)}/readings`,
    );
  }
}
