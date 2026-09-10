package io.github.gergelygreg.smartmetering.meter;

import io.github.gergelygreg.smartmetering.alarm.AlarmService;
import io.github.gergelygreg.smartmetering.meterreading.MeterReadingService;

import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class MeterLifecycleServiceTest {
    @Test
    void deletesMeterThenCleansUpReadingsAndAlarms() {
        MeterService meterService = mock(MeterService.class);
        MeterReadingService readingService = mock(MeterReadingService.class);
        AlarmService alarmService = mock(AlarmService.class);
        MeterLifecycleService lifecycle = new MeterLifecycleService(meterService, readingService, alarmService);
        lifecycle.deleteMeter("meter-123");
        InOrder order = inOrder(meterService, readingService, alarmService);
        order.verify(meterService).deleteMeter("meter-123");
        order.verify(readingService).deleteReadingsForMeter("meter-123");
        order.verify(alarmService).deleteAlarmsForMeter("meter-123");
    }

    @Test
    void doesNotCleanUpChildrenWhenMeterDeletionFails() {
        MeterService meterService = mock(MeterService.class);
        MeterReadingService readingService = mock(MeterReadingService.class);
        AlarmService alarmService = mock(AlarmService.class);
        MeterLifecycleService lifecycle = new MeterLifecycleService(meterService, readingService, alarmService);
        doThrow(new MeterNotFoundException()).when(meterService).deleteMeter("missing-meter");
        assertThrows(MeterNotFoundException.class, () -> lifecycle.deleteMeter("missing-meter"));
        verify(meterService).deleteMeter("missing-meter");
        verifyNoInteractions(readingService, alarmService);
    }
}
