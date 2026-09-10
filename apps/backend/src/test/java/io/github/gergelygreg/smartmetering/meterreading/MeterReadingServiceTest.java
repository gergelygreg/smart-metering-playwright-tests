package io.github.gergelygreg.smartmetering.meterreading;

import java.math.BigDecimal;
import java.time.Instant;

import io.github.gergelygreg.smartmetering.meter.CreateMeterRequest;
import io.github.gergelygreg.smartmetering.meter.MeterNotFoundException;
import io.github.gergelygreg.smartmetering.meter.MeterResponse;
import io.github.gergelygreg.smartmetering.meter.MeterService;
import io.github.gergelygreg.smartmetering.meter.MeterStatus;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MeterReadingServiceTest {

    private MeterService meterService;
    private MeterReadingService meterReadingService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
        meterReadingService = new MeterReadingService(meterService);
    }

    @Test
    void createsReadingForExistingMeter() {
        MeterResponse meter = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-READING-001",
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );

        CreateReadingRequest request = new CreateReadingRequest(
                Instant.parse("2026-01-01T12:00:00Z"),
                new BigDecimal("230.0"),
                new BigDecimal("4.2"),
                new BigDecimal("966.0"),
                new BigDecimal("12543.8")
        );

        MeterReadingResponse reading =
                meterReadingService.createReading(
                        meter.id(),
                        request
                );

        assertFalse(reading.id().isBlank());
        assertEquals(meter.id(), reading.meterId());
        assertEquals(request.timestamp(), reading.timestamp());
        assertEquals(request.voltage(), reading.voltage());
        assertEquals(request.current(), reading.current());
        assertEquals(request.activePower(), reading.activePower());
        assertEquals(request.energyKwh(), reading.energyKwh());
    }

    @Test
    void rejectsReadingForUnknownMeter() {
        CreateReadingRequest request = new CreateReadingRequest(
                Instant.parse("2026-01-01T12:00:00Z"),
                new BigDecimal("230.0"),
                new BigDecimal("4.2"),
                new BigDecimal("966.0"),
                new BigDecimal("12543.8")
        );

        assertThrows(
                MeterNotFoundException.class,
                () -> meterReadingService.createReading(
                        "missing-meter",
                        request
                )
        );
    }
}
