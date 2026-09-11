import type { ReadingRequest } from './contracts.js';

export interface BackendClient {
  createReading(meterId: string, request: ReadingRequest): Promise<void>;
}

export class HttpBackendClient implements BackendClient {
  constructor(private readonly baseUrl: string) {}

  async createReading(
    meterId: string,
    request: ReadingRequest,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/api/meters/${meterId}/readings`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Backend reading ingestion failed: ${response.status} ${body}`,
      );
    }
  }
}