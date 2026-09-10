package io.github.gergelygreg.smartmetering.meterreading;

import java.math.BigDecimal;
import java.time.Instant;

import io.github.gergelygreg.smartmetering.alarm.AlarmService;
import io.github.gergelygreg.smartmetering.meter.MeterNotFoundException;

import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MeterReadingLifecycleServiceTest {
    @Test
    void createsReadingThenEvaluatesAlarms() {
        MeterReadingService readingService = mock(MeterReadingService.class);
        AlarmService alarmService = mock(AlarmService.class);
        MeterReadingLifecycleService lifecycleService = new MeterReadingLifecycleService(readingService, alarmService);
        CreateReadingRequest request = request();
        MeterReadingResponse reading = new MeterReadingResponse(
                "reading-123", "meter-123", request.timestamp(), request.voltage(),
                request.current(), request.activePower(), request.energyKwh()
        );
        when(readingService.createReading("meter-123", request)).thenReturn(reading);
        assertSame(reading, lifecycleService.createReading("meter-123", request));
        InOrder order = inOrder(readingService, alarmService);
        order.verify(readingService).createReading("meter-123", request);
        order.verify(alarmService).evaluateReading(reading);
    }

    @Test
    void doesNotEvaluateAlarmWhenReadingCreationFails() {
        MeterReadingService readingService = mock(MeterReadingService.class);
        AlarmService alarmService = mock(AlarmService.class);
        MeterReadingLifecycleService lifecycleService = new MeterReadingLifecycleService(readingService, alarmService);
        CreateReadingRequest request = request();
        doThrow(new MeterNotFoundException()).when(readingService).createReading("missing-meter", request);
        assertThrows(MeterNotFoundException.class, () -> lifecycleService.createReading("missing-meter", request));
        verifyNoInteractions(alarmService);
    }

    private CreateReadingRequest request() {
        return new CreateReadingRequest(
                Instant.parse("2026-01-01T12:00:00Z"), new BigDecimal("260.0"),
                new BigDecimal("4.2"), new BigDecimal("966.0"), new BigDecimal("12543.8")
        );
    }
}
