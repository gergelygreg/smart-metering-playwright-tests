package io.github.gergelygreg.smartmetering.meter;

import io.github.gergelygreg.smartmetering.meterreading.MeterReadingService;

import org.springframework.stereotype.Service;

@Service
public class MeterLifecycleService {

    private final MeterService meterService;
    private final MeterReadingService meterReadingService;

    public MeterLifecycleService(
            MeterService meterService,
            MeterReadingService meterReadingService
    ) {
        this.meterService = meterService;
        this.meterReadingService = meterReadingService;
    }

    public void deleteMeter(String meterId) {
        meterService.deleteMeter(meterId);
        meterReadingService.deleteReadingsForMeter(meterId);
    }
}
