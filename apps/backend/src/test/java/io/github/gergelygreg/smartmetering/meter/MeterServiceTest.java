package io.github.gergelygreg.smartmetering.meter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

class MeterServiceTest {

    private MeterService meterService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
    }

    @Test
    void shouldCreateMeterWithGeneratedIdAndRequestedData() {
        CreateMeterRequest request = new CreateMeterRequest(
                "SN-UNIT-001",
                MeterStatus.ONLINE,
                "1.0.0"
        );

        MeterResponse result = meterService.createMeter(request);

        assertNotNull(result.id());
        assertFalse(result.id().isBlank());
        assertEquals("SN-UNIT-001", result.serialNumber());
        assertEquals(MeterStatus.ONLINE, result.status());
        assertEquals("1.0.0", result.firmwareVersion());
    }

    @Test
    void shouldGenerateDifferentIdsForDifferentMeters() {
        MeterResponse first = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-UNIT-002",
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );

        MeterResponse second = meterService.createMeter(
                new CreateMeterRequest(
                        "SN-UNIT-003",
                        MeterStatus.OFFLINE,
                        "1.0.1"
                )
        );

        assertNotEquals(first.id(), second.id());
        assertEquals(MeterStatus.OFFLINE, second.status());
        assertEquals("1.0.1", second.firmwareVersion());
    }

    @Test
    void shouldRejectDuplicateSerialNumberWithConflict() {
        CreateMeterRequest request = new CreateMeterRequest(
                "SN-UNIT-DUPLICATE",
                MeterStatus.ONLINE,
                "1.0.0"
        );

        meterService.createMeter(request);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> meterService.createMeter(request)
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals(
                "A meter with this serial number already exists.",
                exception.getReason()
        );
    }
}