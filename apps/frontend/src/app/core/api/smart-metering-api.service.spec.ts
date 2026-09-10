import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SmartMeteringApiService } from './smart-metering-api.service';

describe('SmartMeteringApiService', () => {
  let service: SmartMeteringApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(SmartMeteringApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists meters from the backend contract', () => {
    let result: unknown;

    service.listMeters().subscribe((meters) => {
      result = meters;
    });

    const request = httpTesting.expectOne('/api/meters');
    expect(request.request.method).toBe('GET');

    request.flush([
      {
        id: 'meter-1',
        serialNumber: 'SM-001',
        status: 'ONLINE',
        firmwareVersion: '1.0.0',
      },
    ]);

    expect(result).toEqual([
      {
        id: 'meter-1',
        serialNumber: 'SM-001',
        status: 'ONLINE',
        firmwareVersion: '1.0.0',
      },
    ]);
  });

  it('creates a meter using the REST contract', () => {
    const payload = {
      serialNumber: 'SM-002',
      status: 'ONLINE' as const,
      firmwareVersion: '1.1.0',
    };

    service.createMeter(payload).subscribe();

    const request = httpTesting.expectOne('/api/meters');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);

    request.flush({ id: 'meter-2', ...payload });
  });

  it('creates a meter reading using the nested resource contract', () => {
    const payload = {
      timestamp: '2026-09-11T08:00:00Z',
      voltage: 230,
      current: 4.2,
      activePower: 966,
      energyKwh: 12543.8,
    };

    service.createReading('meter-1', payload).subscribe();

    const request = httpTesting.expectOne('/api/meters/meter-1/readings');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);

    request.flush({
      id: 'reading-1',
      meterId: 'meter-1',
      ...payload,
    });
  });

  it('acknowledges a scoped alarm', () => {
    service.acknowledgeAlarm('meter-1', 'alarm-1').subscribe();

    const request = httpTesting.expectOne(
      '/api/meters/meter-1/alarms/alarm-1/acknowledge',
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});

    request.flush({
      id: 'alarm-1',
      meterId: 'meter-1',
      sourceReadingId: 'reading-1',
      type: 'HIGH_VOLTAGE',
      severity: 'WARNING',
      status: 'ACKNOWLEDGED',
      detectedAt: '2026-09-11T08:00:00Z',
      actualValue: 260,
      threshold: 253,
      acknowledgedAt: '2026-09-11T08:01:00Z',
    });
  });
});