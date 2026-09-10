package io.github.gergelygreg.smartmetering.alarm;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import io.github.gergelygreg.smartmetering.meter.MeterService;
import io.github.gergelygreg.smartmetering.meterreading.MeterReadingResponse;

import org.springframework.stereotype.Service;

@Service
public class AlarmService {

    static final BigDecimal HIGH_VOLTAGE_THRESHOLD = new BigDecimal("253.0");

    private final MeterService meterService;
    private final ConcurrentMap<String, ConcurrentMap<String, AlarmResponse>> alarmsByMeterId =
            new ConcurrentHashMap<>();

    public AlarmService(MeterService meterService) {
        this.meterService = meterService;
    }

    public List<AlarmResponse> evaluateReading(MeterReadingResponse reading) {
        meterService.getMeterById(reading.meterId());

        if (reading.voltage().compareTo(HIGH_VOLTAGE_THRESHOLD) <= 0) {
            return List.of();
        }

        AlarmResponse alarm = new AlarmResponse(
                UUID.randomUUID().toString(),
                reading.meterId(),
                reading.id(),
                AlarmType.HIGH_VOLTAGE,
                AlarmSeverity.WARNING,
                AlarmStatus.ACTIVE,
                reading.timestamp(),
                reading.voltage(),
                HIGH_VOLTAGE_THRESHOLD,
                null
        );

        alarmsByMeterId
                .computeIfAbsent(reading.meterId(), ignored -> new ConcurrentHashMap<>())
                .put(alarm.id(), alarm);

        return List.of(alarm);
    }

    public List<AlarmResponse> getAlarms(String meterId) {
        meterService.getMeterById(meterId);
        ConcurrentMap<String, AlarmResponse> alarms = alarmsByMeterId.get(meterId);
        return alarms == null ? List.of() : List.copyOf(alarms.values());
    }

    public AlarmResponse getAlarm(String meterId, String alarmId) {
        meterService.getMeterById(meterId);
        ConcurrentMap<String, AlarmResponse> alarms = alarmsByMeterId.get(meterId);
        if (alarms == null) { throw new AlarmNotFoundException(); }
        AlarmResponse alarm = alarms.get(alarmId);
        if (alarm == null) { throw new AlarmNotFoundException(); }
        return alarm;
    }

    public AlarmResponse acknowledgeAlarm(String meterId, String alarmId) {
        AlarmResponse existing = getAlarm(meterId, alarmId);
        if (existing.status() == AlarmStatus.ACKNOWLEDGED) { return existing; }

        AlarmResponse acknowledged = new AlarmResponse(
                existing.id(), existing.meterId(), existing.sourceReadingId(),
                existing.type(), existing.severity(), AlarmStatus.ACKNOWLEDGED,
                existing.detectedAt(), existing.actualValue(), existing.threshold(), Instant.now()
        );

        alarmsByMeterId.get(meterId).replace(alarmId, acknowledged);
        return acknowledged;
    }

    public void deleteAlarmsForMeter(String meterId) {
        alarmsByMeterId.remove(meterId);
    }
}
