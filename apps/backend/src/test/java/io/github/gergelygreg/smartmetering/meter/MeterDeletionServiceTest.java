package io.github.gergelygreg.smartmetering.meter;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MeterDeletionServiceTest {

    private MeterService meterService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
    }

    @Test
    void deleteMeterRemovesOnlyTheRequestedMeter() {
        MeterResponse first = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-DELETE-001",
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );

        MeterResponse second = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-DELETE-002",
                        MeterStatus.OFFLINE,
                        "1.1.0"
                )
        );

        meterService.deleteMeter(first.id());

        assertEquals(1, meterService.getAllMeters().size());
        assertFalse(meterService.getAllMeters().contains(first));
        assertTrue(meterService.getAllMeters().contains(second));
        assertEquals(second, meterService.getMeterById(second.id()));

        assertThrows(
                MeterNotFoundException.class,
                () -> meterService.getMeterById(first.id())
        );
    }

    @Test
    void deleteUnknownMeterThrowsNotFound() {
        MeterNotFoundException exception = assertThrows(
                MeterNotFoundException.class,
                () -> meterService.deleteMeter(
                        UUID.randomUUID().toString()
                )
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertEquals("Meter not found.", exception.getReason());
    }

    @Test
    void deletingTheSameMeterTwiceReturnsNotFound() {
        MeterResponse meter = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-DELETE-003",
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );

        meterService.deleteMeter(meter.id());

        assertThrows(
                MeterNotFoundException.class,
                () -> meterService.deleteMeter(meter.id())
        );
    }

    @Test
    void serialNumberCanBeReusedAfterDeletion() {
        MeterResponse original = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-DELETE-004",
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );

        meterService.deleteMeter(original.id());

        MeterResponse replacement = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-DELETE-004",
                        MeterStatus.OFFLINE,
                        "2.0.0"
                )
        );

        assertNotEquals(original.id(), replacement.id());
        assertEquals(
                replacement,
                meterService.getMeterById(replacement.id())
        );
        assertEquals(1, meterService.getAllMeters().size());

        assertThrows(
                MeterNotFoundException.class,
                () -> meterService.getMeterById(original.id())
        );
    }
}
