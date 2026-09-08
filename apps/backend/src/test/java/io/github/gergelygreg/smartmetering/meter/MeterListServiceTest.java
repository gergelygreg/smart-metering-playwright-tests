package io.github.gergelygreg.smartmetering.meter;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MeterListServiceTest {

    private MeterService meterService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
    }

    @Test
    void getAllMetersReturnsEmptyListWhenNoMetersExist() {
        List<MeterResponse> meters = meterService.getAllMeters();

        assertTrue(meters.isEmpty());
    }

    @Test
    void getAllMetersReturnsPreviouslyCreatedMeters() {
        MeterResponse first = meterService.createMeter(
                new CreateMeterRequest("SN-LIST-001", MeterStatus.ONLINE, "1.0.0")
        );

        MeterResponse second = meterService.createMeter(
                new CreateMeterRequest("SN-LIST-002", MeterStatus.OFFLINE, "1.1.0")
        );

        List<MeterResponse> meters = meterService.getAllMeters();

        assertEquals(2, meters.size());
        assertTrue(meters.contains(first));
        assertTrue(meters.contains(second));
    }

    @Test
    void getAllMetersReturnsAnImmutableDetachedList() {
        meterService.createMeter(
                new CreateMeterRequest("SN-LIST-001", MeterStatus.ONLINE, "1.0.0")
        );

        List<MeterResponse> snapshot = meterService.getAllMeters();

        meterService.createMeter(
                new CreateMeterRequest("SN-LIST-002", MeterStatus.OFFLINE, "1.1.0")
        );

        assertEquals(1, snapshot.size());
        assertEquals(2, meterService.getAllMeters().size());

        assertThrows(UnsupportedOperationException.class, snapshot::clear);
    }
}