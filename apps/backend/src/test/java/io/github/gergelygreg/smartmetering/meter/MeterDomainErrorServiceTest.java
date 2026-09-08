package io.github.gergelygreg.smartmetering.meter;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MeterDomainErrorServiceTest {

    private MeterService meterService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
    }

    @Test
    void unknownMeterThrowsTypedNotFoundException() {
        MeterNotFoundException exception = assertThrows(
                MeterNotFoundException.class,
                () -> meterService.getMeterById(UUID.randomUUID().toString())
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertEquals("Meter not found.", exception.getReason());
    }

    @Test
    void duplicateSerialThrowsTypedConflictWithoutReplacingOriginal() {
        MeterResponse original = meterService.createMeter(
                new CreateMeterRequest("SN-DOMAIN-001", MeterStatus.ONLINE, "1.0.0")
        );

        MeterSerialConflictException exception = assertThrows(
                MeterSerialConflictException.class,
                () -> meterService.createMeter(
                        new CreateMeterRequest(
                                "SN-DOMAIN-001",
                                MeterStatus.OFFLINE,
                                "2.0.0"
                        )
                )
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals(
                "A meter with this serial number already exists.",
                exception.getReason()
        );
        assertEquals(original, meterService.getMeterById(original.id()));
    }
}