export type MeterStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'FAULT'
  | 'MAINTENANCE';

export interface CreateMeterRequest {
  serialNumber: string;
  status: MeterStatus;
  firmwareVersion: string;
}

export interface MeterResponse {
  id: string;
  serialNumber: string;
  status: MeterStatus;
  firmwareVersion: string;
}