package io.github.gergelygreg.smartmetering.meter;

import io.github.gergelygreg.smartmetering.alarm.AlarmService;
import io.github.gergelygreg.smartmetering.meterreading.MeterReadingService;

import org.springframework.stereotype.Service;

@Service
public class MeterLifecycleService {

    private final MeterService meterService;
    private final MeterReadingService meterReadingService;
    private final AlarmService alarmService;

    public MeterLifecycleService(
            MeterService meterService,
            MeterReadingService meterReadingService,
            AlarmService alarmService
    ) {
        this.meterService = meterService;
        this.meterReadingService = meterReadingService;
        this.alarmService = alarmService;
    }

    public void deleteMeter(String meterId) {
        meterService.deleteMeter(meterId);
        meterReadingService.deleteReadingsForMeter(meterId);
        alarmService.deleteAlarmsForMeter(meterId);
    }
}
