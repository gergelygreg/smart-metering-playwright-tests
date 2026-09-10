package io.github.gergelygreg.smartmetering.meterreading;

import io.github.gergelygreg.smartmetering.alarm.AlarmService;

import org.springframework.stereotype.Service;

@Service
public class MeterReadingLifecycleService {

    private final MeterReadingService meterReadingService;
    private final AlarmService alarmService;

    public MeterReadingLifecycleService(
            MeterReadingService meterReadingService,
            AlarmService alarmService
    ) {
        this.meterReadingService = meterReadingService;
        this.alarmService = alarmService;
    }

    public MeterReadingResponse createReading(String meterId, CreateReadingRequest request) {
        MeterReadingResponse reading = meterReadingService.createReading(meterId, request);
        alarmService.evaluateReading(reading);
        return reading;
    }
}
