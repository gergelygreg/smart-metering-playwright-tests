import type { APIRequestContext, APIResponse } from '@playwright/test';

export class AlarmApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async getAlarms(meterId: string): Promise<APIResponse> {
    return this.request.get(`/api/meters/${encodeURIComponent(meterId)}/alarms`);
  }

  async getAlarm(meterId: string, alarmId: string): Promise<APIResponse> {
    return this.request.get(
      `/api/meters/${encodeURIComponent(meterId)}/alarms/${encodeURIComponent(alarmId)}`,
    );
  }

  async acknowledgeAlarm(meterId: string, alarmId: string): Promise<APIResponse> {
    return this.request.post(
      `/api/meters/${encodeURIComponent(meterId)}/alarms/${encodeURIComponent(alarmId)}/acknowledge`,
    );
  }
}
