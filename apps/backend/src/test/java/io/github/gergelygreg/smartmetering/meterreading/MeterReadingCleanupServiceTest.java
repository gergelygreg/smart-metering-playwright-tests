package io.github.gergelygreg.smartmetering.meterreading;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import io.github.gergelygreg.smartmetering.meter.CreateMeterRequest;
import io.github.gergelygreg.smartmetering.meter.MeterResponse;
import io.github.gergelygreg.smartmetering.meter.MeterService;
import io.github.gergelygreg.smartmetering.meter.MeterStatus;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MeterReadingCleanupServiceTest {

    private MeterService meterService;
    private MeterReadingService meterReadingService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
        meterReadingService = new MeterReadingService(meterService);
    }

    @Test
    void removesAllReadingsForTargetMeterOnly() {
        MeterResponse targetMeter =
                createMeter("SN-CLEANUP-TARGET");

        MeterResponse otherMeter =
                createMeter("SN-CLEANUP-OTHER");

        meterReadingService.createReading(
                targetMeter.id(),
                readingRequest("2026-01-01T12:00:00Z")
        );

        meterReadingService.createReading(
                targetMeter.id(),
                readingRequest("2026-01-01T12:15:00Z")
        );

        MeterReadingResponse otherReading =
                meterReadingService.createReading(
                        otherMeter.id(),
                        readingRequest(
                                "2026-01-01T12:30:00Z"
                        )
                );

        meterReadingService.deleteReadingsForMeter(
                targetMeter.id()
        );

        assertTrue(
                meterReadingService
                        .getReadings(targetMeter.id())
                        .isEmpty()
        );

        List<MeterReadingResponse> otherReadings =
                meterReadingService.getReadings(
                        otherMeter.id()
                );

        assertEquals(1, otherReadings.size());
        assertTrue(otherReadings.contains(otherReading));
    }

    @Test
    void cleanupIsIdempotentWhenMeterHasNoReadings() {
        MeterResponse meter =
                createMeter("SN-CLEANUP-EMPTY");

        meterReadingService.deleteReadingsForMeter(
                meter.id()
        );

        meterReadingService.deleteReadingsForMeter(
                meter.id()
        );

        assertTrue(
                meterReadingService
                        .getReadings(meter.id())
                        .isEmpty()
        );
    }

    private MeterResponse createMeter(String serialNumber) {
        return meterService.createMeter(
                new CreateMeterRequest(
                        serialNumber,
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );
    }

    private CreateReadingRequest readingRequest(
            String timestamp
    ) {
        return new CreateReadingRequest(
                Instant.parse(timestamp),
                new BigDecimal("230.0"),
                new BigDecimal("4.2"),
                new BigDecimal("966.0"),
                new BigDecimal("12543.8")
        );
    }
}
