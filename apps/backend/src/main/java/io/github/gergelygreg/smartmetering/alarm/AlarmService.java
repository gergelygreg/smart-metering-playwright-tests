package io.github.gergelygreg.smartmetering.alarm;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import io.github.gergelygreg.smartmetering.meter.MeterService;
import io.github.gergelygreg.smartmetering.meterreading.MeterReadingResponse;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AlarmService {

    static final BigDecimal HIGH_VOLTAGE_THRESHOLD =
            new BigDecimal("253.0");

    private final MeterService meterService;
    private final AlarmRepository alarmRepository;

    public AlarmService(
            MeterService meterService,
            AlarmRepository alarmRepository
    ) {
        this.meterService = meterService;
        this.alarmRepository = alarmRepository;
    }

    @Transactional
    public List<AlarmResponse> evaluateReading(MeterReadingResponse reading) {
        meterService.getMeterById(reading.meterId());

        if (reading.voltage().compareTo(HIGH_VOLTAGE_THRESHOLD) <= 0) {
            return List.of();
        }

        AlarmEntity entity = new AlarmEntity(
                UUID.randomUUID().toString(),
                reading.meterId(),
                reading.id(),
                AlarmType.HIGH_VOLTAGE,
                AlarmSeverity.WARNING,
                AlarmStatus.ACTIVE,
                reading.timestamp().truncatedTo(ChronoUnit.MICROS),
                reading.voltage(),
                HIGH_VOLTAGE_THRESHOLD,
                null
        );

        return List.of(toResponse(alarmRepository.saveAndFlush(entity)));
    }

    @Transactional(readOnly = true)
    public List<AlarmResponse> getAlarms(String meterId) {
        meterService.getMeterById(meterId);

        return alarmRepository.findAllByMeterId(meterId)
                .stream()
                .map(AlarmService::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AlarmResponse getAlarm(String meterId, String alarmId) {
        meterService.getMeterById(meterId);

        return alarmRepository.findByIdAndMeterId(alarmId, meterId)
                .map(AlarmService::toResponse)
                .orElseThrow(AlarmNotFoundException::new);
    }

    @Transactional
    public AlarmResponse acknowledgeAlarm(String meterId, String alarmId) {
        meterService.getMeterById(meterId);

        AlarmEntity entity = alarmRepository
                .findByIdAndMeterId(alarmId, meterId)
                .orElseThrow(AlarmNotFoundException::new);

        entity.acknowledge(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return toResponse(alarmRepository.saveAndFlush(entity));
    }

    @Transactional
    public void deleteAlarmsForMeter(String meterId) {
        alarmRepository.deleteByMeterId(meterId);
    }

    private static BigDecimal normalizeDecimal(BigDecimal value) {
        BigDecimal normalized = value.stripTrailingZeros();

        return normalized.scale() < 0
                ? normalized.setScale(0)
                : normalized;
    }

    private static AlarmResponse toResponse(AlarmEntity entity) {
        return new AlarmResponse(
                entity.getId(),
                entity.getMeterId(),
                entity.getSourceReadingId(),
                entity.getType(),
                entity.getSeverity(),
                entity.getStatus(),
                entity.getDetectedAt(),
                normalizeDecimal(entity.getActualValue()),
                normalizeDecimal(entity.getThreshold()),
                entity.getAcknowledgedAt()
        );
    }
}
