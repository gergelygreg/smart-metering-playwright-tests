import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AlarmResponse,
  CreateMeterRequest,
  CreateReadingRequest,
  HealthResponse,
  MeterReadingResponse,
  MeterResponse,
} from '../models/smart-metering.models';

@Injectable({ providedIn: 'root' })
export class SmartMeteringApiService {
  private readonly http = inject(HttpClient);

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>('/api/health');
  }

  listMeters(): Observable<MeterResponse[]> {
    return this.http.get<MeterResponse[]>('/api/meters');
  }

  createMeter(request: CreateMeterRequest): Observable<MeterResponse> {
    return this.http.post<MeterResponse>('/api/meters', request);
  }

  getMeter(id: string): Observable<MeterResponse> {
    return this.http.get<MeterResponse>(`/api/meters/${id}`);
  }

  deleteMeter(id: string): Observable<void> {
    return this.http.delete<void>(`/api/meters/${id}`);
  }

  listReadings(meterId: string): Observable<MeterReadingResponse[]> {
    return this.http.get<MeterReadingResponse[]>(`/api/meters/${meterId}/readings`);
  }

  createReading(
    meterId: string,
    request: CreateReadingRequest,
  ): Observable<MeterReadingResponse> {
    return this.http.post<MeterReadingResponse>(
      `/api/meters/${meterId}/readings`,
      request,
    );
  }

  getReading(meterId: string, readingId: string): Observable<MeterReadingResponse> {
    return this.http.get<MeterReadingResponse>(
      `/api/meters/${meterId}/readings/${readingId}`,
    );
  }

  listAlarms(meterId: string): Observable<AlarmResponse[]> {
    return this.http.get<AlarmResponse[]>(`/api/meters/${meterId}/alarms`);
  }

  getAlarm(meterId: string, alarmId: string): Observable<AlarmResponse> {
    return this.http.get<AlarmResponse>(
      `/api/meters/${meterId}/alarms/${alarmId}`,
    );
  }

  acknowledgeAlarm(meterId: string, alarmId: string): Observable<AlarmResponse> {
    return this.http.post<AlarmResponse>(
      `/api/meters/${meterId}/alarms/${alarmId}/acknowledge`,
      {},
    );
  }
}