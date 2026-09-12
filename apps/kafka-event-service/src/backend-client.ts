import {
  readingRequest,
  type AlarmResponse,
  type ReadingResponse,
  type TelemetryEvent,
} from './contracts.js';

export interface BackendClient {
  createReading(event: TelemetryEvent): Promise<ReadingResponse>;
  getAlarms(meterId: string): Promise<AlarmResponse[]>;
}

export class HttpBackendClient implements BackendClient {
  constructor(private readonly baseUrl: string) {}

  async createReading(event: TelemetryEvent): Promise<ReadingResponse> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/api/meters/${event.meterId}/readings`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(readingRequest(event)),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Backend reading write failed: ${response.status} ${await response.text()}`,
      );
    }

    return (await response.json()) as ReadingResponse;
  }

  async getAlarms(meterId: string): Promise<AlarmResponse[]> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/api/meters/${meterId}/alarms`,
    );

    if (!response.ok) {
      throw new Error(
        `Backend alarm query failed: ${response.status} ${await response.text()}`,
      );
    }

    return (await response.json()) as AlarmResponse[];
  }
}
