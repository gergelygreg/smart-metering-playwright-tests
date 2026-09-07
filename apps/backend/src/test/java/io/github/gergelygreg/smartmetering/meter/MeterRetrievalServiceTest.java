package io.github.gergelygreg.smartmetering.meter;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MeterRetrievalServiceTest {

    private MeterService meterService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
    }

    @Test
    void shouldReturnPreviouslyCreatedMeterById() {
        MeterResponse created = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-RETRIEVAL-001",
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );

        MeterResponse retrieved = meterService.getMeterById(created.id());

        assertEquals(created, retrieved);
    }

    @Test
    void shouldRejectUnknownMeterIdWithNotFound() {
        String unknownId = UUID.randomUUID().toString();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> meterService.getMeterById(unknownId)
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertEquals("Meter not found.", exception.getReason());
    }
}