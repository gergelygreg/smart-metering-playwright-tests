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
import static org.junit.jupiter.api.Assertions.assertThrows;

class MeterReadingRetrievalServiceTest {

    private MeterService meterService;
    private MeterReadingService meterReadingService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
        meterReadingService = new MeterReadingService(meterService);
    }

    @Test
    void returnsPreviouslyCreatedReading() {
        MeterResponse meter = createMeter("SN-READ-GET-001");

        MeterReadingResponse created =
                meterReadingService.createReading(
                        meter.id(),
                        readingRequest()
                );

        MeterReadingResponse retrieved =
                meterReadingService.getReading(
                        meter.id(),
                        created.id()
                );

        assertEquals(created, retrieved);
    }

    @Test
    void unknownReadingThrowsReadingNotFound() {
        MeterResponse meter = createMeter("SN-READ-GET-002");

        assertThrows(
                MeterReadingNotFoundException.class,
                () -> meterReadingService.getReading(
                        meter.id(),
                        "missing-reading"
                )
        );
    }

    @Test
    void readingCannotBeReadThroughAnotherMeter() {
        MeterResponse owner = createMeter("SN-READ-GET-003");
        MeterResponse other = createMeter("SN-READ-GET-004");

        MeterReadingResponse reading =
                meterReadingService.createReading(
                        owner.id(),
                        readingRequest()
                );

        assertThrows(
                MeterReadingNotFoundException.class,
                () -> meterReadingService.getReading(
                        other.id(),
                        reading.id()
                )
        );
    }

    @Test
    void unknownMeterStillThrowsMeterNotFound() {
        assertThrows(
                MeterNotFoundException.class,
                () -> meterReadingService.getReading(
                        "missing-meter",
                        "missing-reading"
                )
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

    private CreateReadingRequest readingRequest() {
        return new CreateReadingRequest(
                Instant.parse("2026-01-01T12:00:00Z"),
                new BigDecimal("230.0"),
                new BigDecimal("4.2"),
                new BigDecimal("966.0"),
                new BigDecimal("12543.8")
        );
    }
}
