package io.github.gergelygreg.smartmetering.meterreading;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import io.github.gergelygreg.smartmetering.meter.CreateMeterRequest;
import io.github.gergelygreg.smartmetering.meter.MeterNotFoundException;
import io.github.gergelygreg.smartmetering.meter.MeterResponse;
import io.github.gergelygreg.smartmetering.meter.MeterService;
import io.github.gergelygreg.smartmetering.meter.MeterStatus;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MeterReadingListServiceTest {

    private MeterService meterService;
    private MeterReadingService meterReadingService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
        meterReadingService = new MeterReadingService(meterService);
    }

    @Test
    void returnsEmptyListForExistingMeterWithoutReadings() {
        MeterResponse meter = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-READING-LIST-001",
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );

        List<MeterReadingResponse> readings =
                meterReadingService.getReadings(meter.id());

        assertTrue(readings.isEmpty());
    }

    @Test
    void returnsPreviouslyCreatedReadingsForMeter() {
        MeterResponse meter = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-READING-LIST-002",
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );

        MeterReadingResponse first =
                meterReadingService.createReading(
                        meter.id(),
                        request(
                                "2026-01-01T12:00:00Z",
                                "230.0",
                                "4.2",
                                "966.0",
                                "12543.8"
                        )
                );

        MeterReadingResponse second =
                meterReadingService.createReading(
                        meter.id(),
                        request(
                                "2026-01-01T12:15:00Z",
                                "231.5",
                                "4.5",
                                "1041.8",
                                "12544.1"
                        )
                );

        List<MeterReadingResponse> readings =
                meterReadingService.getReadings(meter.id());

        assertEquals(2, readings.size());
        assertTrue(readings.contains(first));
        assertTrue(readings.contains(second));
    }

    @Test
    void rejectsHistoryRequestForUnknownMeter() {
        assertThrows(
                MeterNotFoundException.class,
                () -> meterReadingService.getReadings(
                        "missing-meter"
                )
        );
    }

    private CreateReadingRequest request(
            String timestamp,
            String voltage,
            String current,
            String activePower,
            String energyKwh
    ) {
        return new CreateReadingRequest(
                Instant.parse(timestamp),
                new BigDecimal(voltage),
                new BigDecimal(current),
                new BigDecimal(activePower),
                new BigDecimal(energyKwh)
        );
    }
}
