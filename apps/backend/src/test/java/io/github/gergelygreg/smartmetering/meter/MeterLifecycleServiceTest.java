package io.github.gergelygreg.smartmetering.meter;

import io.github.gergelygreg.smartmetering.meterreading.MeterReadingService;

import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class MeterLifecycleServiceTest {

    @Test
    void deletesMeterThenCleansUpItsReadings() {
        MeterService meterService =
                mock(MeterService.class);

        MeterReadingService meterReadingService =
                mock(MeterReadingService.class);

        MeterLifecycleService lifecycleService =
                new MeterLifecycleService(
                        meterService,
                        meterReadingService
                );

        lifecycleService.deleteMeter("meter-123");

        InOrder order = inOrder(
                meterService,
                meterReadingService
        );

        order.verify(meterService)
                .deleteMeter("meter-123");

        order.verify(meterReadingService)
                .deleteReadingsForMeter("meter-123");
    }

    @Test
    void doesNotCleanUpReadingsWhenMeterDeletionFails() {
        MeterService meterService =
                mock(MeterService.class);

        MeterReadingService meterReadingService =
                mock(MeterReadingService.class);

        MeterLifecycleService lifecycleService =
                new MeterLifecycleService(
                        meterService,
                        meterReadingService
                );

        doThrow(new MeterNotFoundException())
                .when(meterService)
                .deleteMeter("missing-meter");

        assertThrows(
                MeterNotFoundException.class,
                () -> lifecycleService.deleteMeter(
                        "missing-meter"
                )
        );

        verify(meterService)
                .deleteMeter("missing-meter");

        verifyNoInteractions(meterReadingService);
    }
}
