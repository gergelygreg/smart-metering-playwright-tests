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
