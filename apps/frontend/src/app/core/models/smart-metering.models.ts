export type MeterStatus = 'ONLINE' | 'OFFLINE' | 'FAULT' | 'MAINTENANCE';

export interface HealthResponse {
  status: string;
  service: string;
}

export interface CreateMeterRequest {
  serialNumber: string;
  status: MeterStatus;
  firmwareVersion: string;
}

export interface MeterResponse extends CreateMeterRequest {
  id: string;
}

export interface CreateReadingRequest {
  timestamp: string;
  voltage: number;
  current: number;
  activePower: number;
  energyKwh: number;
}

export interface MeterReadingResponse extends CreateReadingRequest {
  id: string;
  meterId: string;
}

export type AlarmType = 'HIGH_VOLTAGE';
export type AlarmSeverity = 'WARNING';
export type AlarmStatus = 'ACTIVE' | 'ACKNOWLEDGED';

export interface AlarmResponse {
  id: string;
  meterId: string;
  sourceReadingId: string;
  type: AlarmType;
  severity: AlarmSeverity;
  status: AlarmStatus;
  detectedAt: string;
  actualValue: number;
  threshold: number;
  acknowledgedAt: string | null;
}