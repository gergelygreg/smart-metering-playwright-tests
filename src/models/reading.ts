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
