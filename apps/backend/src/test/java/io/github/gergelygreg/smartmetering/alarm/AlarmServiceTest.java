package io.github.gergelygreg.smartmetering.alarm;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import io.github.gergelygreg.smartmetering.meter.CreateMeterRequest;
import io.github.gergelygreg.smartmetering.meter.MeterResponse;
import io.github.gergelygreg.smartmetering.meter.MeterService;
import io.github.gergelygreg.smartmetering.meter.MeterStatus;
import io.github.gergelygreg.smartmetering.meterreading.MeterReadingResponse;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AlarmServiceTest {
    private MeterService meterService;
    private AlarmService alarmService;

    @BeforeEach
    void setUp() {
        meterService = new MeterService();
        alarmService = new AlarmService(meterService);
    }

    @Test
    void normalVoltageDoesNotCreateAlarm() {
        MeterResponse meter = createMeter("SN-ALARM-001");
        assertTrue(alarmService.evaluateReading(reading(meter.id(), "reading-001", "230.0")).isEmpty());
        assertTrue(alarmService.getAlarms(meter.id()).isEmpty());
    }

    @Test
    void highVoltageCreatesActiveWarningAlarm() {
        MeterResponse meter = createMeter("SN-ALARM-002");
        AlarmResponse alarm = alarmService.evaluateReading(reading(meter.id(), "reading-002", "260.0")).getFirst();
        assertNotNull(alarm.id());
        assertEquals(meter.id(), alarm.meterId());
        assertEquals("reading-002", alarm.sourceReadingId());
        assertEquals(AlarmType.HIGH_VOLTAGE, alarm.type());
        assertEquals(AlarmSeverity.WARNING, alarm.severity());
        assertEquals(AlarmStatus.ACTIVE, alarm.status());
        assertEquals(new BigDecimal("260.0"), alarm.actualValue());
        assertEquals(AlarmService.HIGH_VOLTAGE_THRESHOLD, alarm.threshold());
        assertNull(alarm.acknowledgedAt());
    }

    @Test
    void listsOnlyAlarmsForRequestedMeter() {
        MeterResponse first = createMeter("SN-ALARM-003");
        MeterResponse second = createMeter("SN-ALARM-004");
        AlarmResponse firstAlarm = alarmService.evaluateReading(reading(first.id(), "reading-003", "260.0")).getFirst();
        alarmService.evaluateReading(reading(second.id(), "reading-004", "261.0"));
        List<AlarmResponse> alarms = alarmService.getAlarms(first.id());
        assertEquals(1, alarms.size());
        assertTrue(alarms.contains(firstAlarm));
    }

    @Test
    void unknownAlarmThrowsAlarmNotFound() {
        MeterResponse meter = createMeter("SN-ALARM-005");
        assertThrows(AlarmNotFoundException.class, () -> alarmService.getAlarm(meter.id(), "missing-alarm"));
    }

    @Test
    void alarmCannotBeReadThroughAnotherMeter() {
        MeterResponse owner = createMeter("SN-ALARM-006");
        MeterResponse other = createMeter("SN-ALARM-007");
        AlarmResponse alarm = alarmService.evaluateReading(reading(owner.id(), "reading-006", "260.0")).getFirst();
        assertThrows(AlarmNotFoundException.class, () -> alarmService.getAlarm(other.id(), alarm.id()));
    }

    @Test
    void acknowledgementIsIdempotent() {
        MeterResponse meter = createMeter("SN-ALARM-008");
        AlarmResponse alarm = alarmService.evaluateReading(reading(meter.id(), "reading-008", "260.0")).getFirst();
        AlarmResponse first = alarmService.acknowledgeAlarm(meter.id(), alarm.id());
        AlarmResponse second = alarmService.acknowledgeAlarm(meter.id(), alarm.id());
        assertEquals(AlarmStatus.ACKNOWLEDGED, first.status());
        assertNotNull(first.acknowledgedAt());
        assertEquals(first.acknowledgedAt(), second.acknowledgedAt());
        assertSame(first, second);
    }

    @Test
    void deleteAlarmsForMeterRemovesOnlyTargetMeterAlarms() {
        MeterResponse target = createMeter("SN-ALARM-009");
        MeterResponse other = createMeter("SN-ALARM-010");
        alarmService.evaluateReading(reading(target.id(), "reading-009", "260.0"));
        AlarmResponse otherAlarm = alarmService.evaluateReading(reading(other.id(), "reading-010", "261.0")).getFirst();
        alarmService.deleteAlarmsForMeter(target.id());
        assertTrue(alarmService.getAlarms(target.id()).isEmpty());
        assertTrue(alarmService.getAlarms(other.id()).contains(otherAlarm));
    }

    private MeterResponse createMeter(String serialNumber) {
        return meterService.createMeter(new CreateMeterRequest(serialNumber, MeterStatus.ONLINE, "1.0.0"));
    }

    private MeterReadingResponse reading(String meterId, String readingId, String voltage) {
        return new MeterReadingResponse(
                readingId, meterId, Instant.parse("2026-01-01T12:00:00Z"),
                new BigDecimal(voltage), new BigDecimal("4.2"),
                new BigDecimal("966.0"), new BigDecimal("12543.8")
        );
    }
}
