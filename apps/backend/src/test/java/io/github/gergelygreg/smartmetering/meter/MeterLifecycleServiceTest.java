package io.github.gergelygreg.smartmetering.meter;

import io.github.gergelygreg.smartmetering.alarm.AlarmService;
import io.github.gergelygreg.smartmetering.meterreading.MeterReadingService;

import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MeterLifecycleServiceTest {

    @Test
    void validatesMeterThenDeletesChildrenBeforeParent() {
        MeterService meterService =
                mock(MeterService.class);

        MeterReadingService meterReadingService =
                mock(MeterReadingService.class);

        AlarmService alarmService =
                mock(AlarmService.class);

        MeterLifecycleService lifecycleService =
                new MeterLifecycleService(
                        meterService,
                        meterReadingService,
                        alarmService
                );

        lifecycleService.deleteMeter("meter-123");

        InOrder order = inOrder(
                meterService,
                alarmService,
                meterReadingService
        );

        order.verify(meterService)
                .getMeterById("meter-123");

        order.verify(alarmService)
                .deleteAlarmsForMeter("meter-123");

        order.verify(meterReadingService)
                .deleteReadingsForMeter("meter-123");

        order.verify(meterService)
                .deleteMeter("meter-123");
    }

    @Test
    void missingMeterDoesNotDeleteChildrenOrParent() {
        MeterService meterService =
                mock(MeterService.class);

        MeterReadingService meterReadingService =
                mock(MeterReadingService.class);

        AlarmService alarmService =
                mock(AlarmService.class);

        MeterLifecycleService lifecycleService =
                new MeterLifecycleService(
                        meterService,
                        meterReadingService,
                        alarmService
                );

        when(meterService.getMeterById("missing-meter"))
                .thenThrow(new MeterNotFoundException());

        assertThrows(
                MeterNotFoundException.class,
                () -> lifecycleService.deleteMeter(
                        "missing-meter"
                )
        );

        verify(meterService)
                .getMeterById("missing-meter");

        verify(meterService, never())
                .deleteMeter("missing-meter");

        verifyNoInteractions(
                meterReadingService,
                alarmService
        );
    }
}
