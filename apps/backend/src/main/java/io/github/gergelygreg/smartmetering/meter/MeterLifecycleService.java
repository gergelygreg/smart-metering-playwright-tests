package io.github.gergelygreg.smartmetering.meter;

import io.github.gergelygreg.smartmetering.alarm.AlarmService;
import io.github.gergelygreg.smartmetering.meterreading.MeterReadingService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public void deleteMeter(String meterId) {
        meterService.getMeterById(meterId);

        alarmService.deleteAlarmsForMeter(meterId);
        meterReadingService.deleteReadingsForMeter(meterId);

        meterService.deleteMeter(meterId);
    }
}
