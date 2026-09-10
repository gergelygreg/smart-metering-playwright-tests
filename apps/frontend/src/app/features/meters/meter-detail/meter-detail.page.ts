import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SmartMeteringApiService } from '../../../core/api/smart-metering-api.service';
import {
  AlarmResponse,
  MeterReadingResponse,
  MeterResponse,
} from '../../../core/models/smart-metering.models';

@Component({
  selector: 'app-meter-detail-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './meter-detail.page.html',
  styleUrls: ['./meter-detail.page.css'],
})
export class MeterDetailPage implements OnInit {
  private readonly api = inject(SmartMeteringApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly meter = signal<MeterResponse | null>(null);
  readonly readings = signal<MeterReadingResponse[]>([]);
  readonly alarms = signal<AlarmResponse[]>([]);
  readonly loading = signal(true);
  readonly submittingReading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly meterId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly readingForm = this.formBuilder.nonNullable.group({
    timestamp: [this.localDateTimeValue(new Date()), Validators.required],
    voltage: [230, [Validators.required, Validators.min(0.001)]],
    current: [4.2, [Validators.required, Validators.min(0)]],
    activePower: [966, Validators.required],
    energyKwh: [12543.8, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    if (!this.meterId) {
      this.error.set('Meter id is missing.');
      this.loading.set(false);
      return;
    }

    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      meter: this.api.getMeter(this.meterId),
      readings: this.api.listReadings(this.meterId),
      alarms: this.api.listAlarms(this.meterId),
    }).subscribe({
      next: ({ meter, readings, alarms }) => {
        this.meter.set(meter);
        this.readings.set(this.sortReadings(readings));
        this.alarms.set(this.sortAlarms(alarms));
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(
          error?.error?.code === 'METER_NOT_FOUND'
            ? 'The requested meter does not exist.'
            : 'Meter operational data is temporarily unavailable.',
        );
        this.loading.set(false);
      },
    });
  }

  createReading(): void {
    if (this.readingForm.invalid || this.submittingReading()) {
      this.readingForm.markAllAsTouched();
      return;
    }

    const value = this.readingForm.getRawValue();
    const timestamp = new Date(value.timestamp);

    if (Number.isNaN(timestamp.getTime())) {
      this.error.set('Reading timestamp is invalid.');
      return;
    }

    this.submittingReading.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api
      .createReading(this.meterId, {
        timestamp: timestamp.toISOString(),
        voltage: Number(value.voltage),
        current: Number(value.current),
        activePower: Number(value.activePower),
        energyKwh: Number(value.energyKwh),
      })
      .subscribe({
        next: (reading) => {
          this.success.set(`Reading ${reading.id} stored.`);
          this.submittingReading.set(false);
          this.refreshOperationalData();
        },
        error: () => {
          this.error.set('Reading creation failed.');
          this.submittingReading.set(false);
        },
      });
  }

  acknowledgeAlarm(alarm: AlarmResponse): void {
    this.error.set(null);

    this.api.acknowledgeAlarm(this.meterId, alarm.id).subscribe({
      next: (acknowledged) => {
        this.alarms.update((alarms) =>
          alarms.map((candidate) =>
            candidate.id === acknowledged.id ? acknowledged : candidate,
          ),
        );
        this.success.set(`Alarm ${alarm.id} acknowledged.`);
      },
      error: () => {
        this.error.set(`Could not acknowledge alarm ${alarm.id}.`);
      },
    });
  }

  deleteMeter(): void {
    const meter = this.meter();

    if (!meter) {
      return;
    }

    if (!window.confirm(`Delete meter ${meter.serialNumber} and all child data?`)) {
      return;
    }

    this.api.deleteMeter(meter.id).subscribe({
      next: () => {
        void this.router.navigate(['/meters']);
      },
      error: () => {
        this.error.set(`Could not delete meter ${meter.serialNumber}.`);
      },
    });
  }

  private refreshOperationalData(): void {
    forkJoin({
      readings: this.api.listReadings(this.meterId),
      alarms: this.api.listAlarms(this.meterId),
    }).subscribe({
      next: ({ readings, alarms }) => {
        this.readings.set(this.sortReadings(readings));
        this.alarms.set(this.sortAlarms(alarms));
      },
      error: () => {
        this.error.set('Could not refresh operational data.');
      },
    });
  }

  private sortReadings(readings: MeterReadingResponse[]): MeterReadingResponse[] {
    return [...readings].sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
  }

  private sortAlarms(alarms: AlarmResponse[]): AlarmResponse[] {
    return [...alarms].sort(
      (left, right) =>
        new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime(),
    );
  }

  private localDateTimeValue(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }
}