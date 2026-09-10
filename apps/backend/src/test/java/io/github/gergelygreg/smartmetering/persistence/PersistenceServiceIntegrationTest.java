package io.github.gergelygreg.smartmetering.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import io.github.gergelygreg.smartmetering.alarm.*;
import io.github.gergelygreg.smartmetering.meter.*;
import io.github.gergelygreg.smartmetering.meterreading.*;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class PersistenceServiceIntegrationTest {

    @Autowired private MeterService meterService;
    @Autowired private MeterReadingService readingService;
    @Autowired private MeterReadingLifecycleService readingLifecycleService;
    @Autowired private AlarmService alarmService;
    @Autowired private MeterLifecycleService meterLifecycleService;

    @Autowired private MeterRepository meterRepository;
    @Autowired private MeterReadingRepository readingRepository;
    @Autowired private AlarmRepository alarmRepository;

    @AfterEach
    void cleanUp() {
        alarmRepository.deleteAll();
        readingRepository.deleteAll();
        meterRepository.deleteAll();
    }

    @Test
    void createsAndRetrievesPersistedMeter() {
        MeterResponse meter = createMeter("SN-PERSIST-001");
        assertTrue(meterRepository.existsById(meter.id()));
        assertEquals(meter, meterService.getMeterById(meter.id()));
    }

    @Test
    void duplicateSerialKeepsDomainConflictContract() {
        createMeter("SN-PERSIST-002");
        assertThrows(
                MeterSerialConflictException.class,
                () -> createMeter("SN-PERSIST-002")
        );
    }

    @Test
    void listsPersistedMeters() {
        MeterResponse first = createMeter("SN-PERSIST-003");
        MeterResponse second = createMeter("SN-PERSIST-004");
        List<MeterResponse> meters = meterService.getAllMeters();
        assertTrue(meters.contains(first));
        assertTrue(meters.contains(second));
    }

    @Test
    void unknownMeterKeepsNotFoundContract() {
        assertThrows(
                MeterNotFoundException.class,
                () -> meterService.getMeterById("missing-meter")
        );
    }

    @Test
    void deletionRemovesPersistedMeter() {
        MeterResponse meter = createMeter("SN-PERSIST-005");
        meterService.deleteMeter(meter.id());
        assertFalse(meterRepository.existsById(meter.id()));
    }

    @Test
    void serialCanBeReusedAfterDeletion() {
        MeterResponse meter = createMeter("SN-PERSIST-006");
        meterService.deleteMeter(meter.id());
        MeterResponse replacement = createMeter("SN-PERSIST-006");
        assertNotEquals(meter.id(), replacement.id());
    }

    @Test
    void createsPersistedReading() {
        MeterResponse meter = createMeter("SN-PERSIST-007");
        MeterReadingResponse reading =
                readingService.createReading(meter.id(), reading("230.0"));
        assertTrue(readingRepository.existsById(reading.id()));
    }

    @Test
    void readingHistoryIsMeterScoped() {
        MeterResponse first = createMeter("SN-PERSIST-008");
        MeterResponse second = createMeter("SN-PERSIST-009");
        readingService.createReading(first.id(), reading("230.0"));
        readingService.createReading(second.id(), reading("240.0"));
        assertEquals(1, readingService.getReadings(first.id()).size());
    }

    @Test
    void retrievesPersistedReadingByCompositeScope() {
        MeterResponse meter = createMeter("SN-PERSIST-010");
        MeterReadingResponse reading =
                readingService.createReading(meter.id(), reading("230.0"));
        assertEquals(
                reading,
                readingService.getReading(meter.id(), reading.id())
        );
    }

    @Test
    void readingCannotLeakAcrossMeters() {
        MeterResponse owner = createMeter("SN-PERSIST-011");
        MeterResponse other = createMeter("SN-PERSIST-012");
        MeterReadingResponse reading =
                readingService.createReading(owner.id(), reading("230.0"));
        assertThrows(
                MeterReadingNotFoundException.class,
                () -> readingService.getReading(other.id(), reading.id())
        );
    }

    @Test
    void readingCleanupIsScoped() {
        MeterResponse target = createMeter("SN-PERSIST-013");
        MeterResponse other = createMeter("SN-PERSIST-014");
        readingService.createReading(target.id(), reading("230.0"));
        readingService.createReading(other.id(), reading("240.0"));
        readingService.deleteReadingsForMeter(target.id());
        assertTrue(readingRepository.findAllByMeterId(target.id()).isEmpty());
        assertEquals(1, readingRepository.findAllByMeterId(other.id()).size());
    }

    @Test
    void normalVoltageDoesNotPersistAlarm() {
        MeterResponse meter = createMeter("SN-PERSIST-015");
        readingLifecycleService.createReading(meter.id(), reading("230.0"));
        assertTrue(alarmService.getAlarms(meter.id()).isEmpty());
    }

    @Test
    void highVoltagePersistsGeneratedAlarm() {
        MeterResponse meter = createMeter("SN-PERSIST-016");
        MeterReadingResponse reading =
                readingLifecycleService.createReading(meter.id(), reading("260.0"));
        AlarmResponse alarm = alarmService.getAlarms(meter.id()).getFirst();
        assertEquals(reading.id(), alarm.sourceReadingId());
        assertEquals(AlarmStatus.ACTIVE, alarm.status());
        assertTrue(alarmRepository.existsById(alarm.id()));
    }

    @Test
    void alarmCannotLeakAcrossMeters() {
        MeterResponse owner = createMeter("SN-PERSIST-017");
        MeterResponse other = createMeter("SN-PERSIST-018");
        readingLifecycleService.createReading(owner.id(), reading("260.0"));
        AlarmResponse alarm = alarmService.getAlarms(owner.id()).getFirst();
        assertThrows(
                AlarmNotFoundException.class,
                () -> alarmService.getAlarm(other.id(), alarm.id())
        );
    }

    @Test
    void acknowledgementIsPersistedAndIdempotent() {
        MeterResponse meter = createMeter("SN-PERSIST-019");
        readingLifecycleService.createReading(meter.id(), reading("260.0"));
        AlarmResponse alarm = alarmService.getAlarms(meter.id()).getFirst();

        AlarmResponse first =
                alarmService.acknowledgeAlarm(meter.id(), alarm.id());
        AlarmResponse second =
                alarmService.acknowledgeAlarm(meter.id(), alarm.id());

        assertEquals(AlarmStatus.ACKNOWLEDGED, first.status());
        assertNotNull(first.acknowledgedAt());
        assertEquals(first.acknowledgedAt(), second.acknowledgedAt());
        assertEquals(
                AlarmStatus.ACKNOWLEDGED,
                alarmService.getAlarm(meter.id(), alarm.id()).status()
        );
    }

    @Test
    void alarmCleanupIsMeterScoped() {
        MeterResponse target = createMeter("SN-PERSIST-020");
        MeterResponse other = createMeter("SN-PERSIST-021");
        readingLifecycleService.createReading(target.id(), reading("260.0"));
        readingLifecycleService.createReading(other.id(), reading("261.0"));
        alarmService.deleteAlarmsForMeter(target.id());
        assertTrue(alarmRepository.findAllByMeterId(target.id()).isEmpty());
        assertEquals(1, alarmRepository.findAllByMeterId(other.id()).size());
    }

    @Test
    void lifecycleDeletionRemovesAggregate() {
        MeterResponse meter = createMeter("SN-PERSIST-022");
        MeterReadingResponse reading =
                readingLifecycleService.createReading(meter.id(), reading("260.0"));
        AlarmResponse alarm = alarmService.getAlarms(meter.id()).getFirst();

        meterLifecycleService.deleteMeter(meter.id());

        assertFalse(meterRepository.existsById(meter.id()));
        assertFalse(readingRepository.existsById(reading.id()));
        assertFalse(alarmRepository.existsById(alarm.id()));
    }

    @Test
    void directDatabaseMeterDeleteIsProtectedByCascadeConstraints() {
        MeterResponse meter = createMeter("SN-PERSIST-023");
        MeterReadingResponse reading =
                readingLifecycleService.createReading(meter.id(), reading("260.0"));
        AlarmResponse alarm = alarmService.getAlarms(meter.id()).getFirst();

        meterRepository.deleteById(meter.id());
        meterRepository.flush();

        assertFalse(readingRepository.existsById(reading.id()));
        assertFalse(alarmRepository.existsById(alarm.id()));
    }

    private MeterResponse createMeter(String serial) {
        return meterService.createMeter(
                new CreateMeterRequest(
                        serial,
                        MeterStatus.ONLINE,
                        "1.0.0"
                )
        );
    }

    private CreateReadingRequest reading(String voltage) {
        return new CreateReadingRequest(
                Instant.parse("2026-01-01T12:00:00Z"),
                new BigDecimal(voltage),
                new BigDecimal("4.2"),
                new BigDecimal("966.0"),
                new BigDecimal("12543.8")
        );
    }
}
