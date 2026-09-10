import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SmartMeteringApiService } from '../../../core/api/smart-metering-api.service';
import {
  MeterResponse,
  MeterStatus,
} from '../../../core/models/smart-metering.models';

@Component({
  selector: 'app-meter-list-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './meter-list.page.html',
  styleUrls: ['./meter-list.page.css'],
})
export class MeterListPage implements OnInit {
  private readonly api = inject(SmartMeteringApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly meters = signal<MeterResponse[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly healthStatus = signal('CHECKING');
  readonly meterStatuses: MeterStatus[] = [
    'ONLINE',
    'OFFLINE',
    'FAULT',
    'MAINTENANCE',
  ];

  readonly meterForm = this.formBuilder.nonNullable.group({
    serialNumber: ['', [Validators.required, Validators.maxLength(64)]],
    status: ['ONLINE' as MeterStatus, Validators.required],
    firmwareVersion: ['1.0.0', [Validators.required, Validators.maxLength(64)]],
  });

  ngOnInit(): void {
    this.loadHealth();
    this.loadMeters();
  }

  loadMeters(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.listMeters().subscribe({
      next: (meters) => {
        this.meters.set(this.sortMeters(meters));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Meter data is temporarily unavailable.');
        this.loading.set(false);
      },
    });
  }

  createMeter(): void {
    if (this.meterForm.invalid || this.submitting()) {
      this.meterForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api.createMeter(this.meterForm.getRawValue()).subscribe({
      next: (meter) => {
        this.meters.update((meters) => this.sortMeters([...meters, meter]));
        this.meterForm.reset({
          serialNumber: '',
          status: 'ONLINE',
          firmwareVersion: '1.0.0',
        });
        this.success.set(`Meter ${meter.serialNumber} created.`);
        this.submitting.set(false);
      },
      error: (error) => {
        const code = error?.error?.code;
        this.error.set(
          code === 'METER_SERIAL_CONFLICT'
            ? 'A meter with this serial number already exists.'
            : 'Meter creation failed.',
        );
        this.submitting.set(false);
      },
    });
  }

  deleteMeter(meter: MeterResponse): void {
    if (!window.confirm(`Delete meter ${meter.serialNumber} and its operational data?`)) {
      return;
    }

    this.error.set(null);
    this.success.set(null);

    this.api.deleteMeter(meter.id).subscribe({
      next: () => {
        this.meters.update((meters) =>
          meters.filter((candidate) => candidate.id !== meter.id),
        );
        this.success.set(`Meter ${meter.serialNumber} deleted.`);
      },
      error: () => {
        this.error.set(`Could not delete meter ${meter.serialNumber}.`);
      },
    });
  }

  statusClass(status: MeterStatus): string {
    return `status-badge status-${status.toLowerCase()}`;
  }

  private loadHealth(): void {
    this.api.health().subscribe({
      next: (health) => this.healthStatus.set(health.status),
      error: () => this.healthStatus.set('DOWN'),
    });
  }

  private sortMeters(meters: MeterResponse[]): MeterResponse[] {
    return [...meters].sort((left, right) =>
      left.serialNumber.localeCompare(right.serialNumber),
    );
  }
}