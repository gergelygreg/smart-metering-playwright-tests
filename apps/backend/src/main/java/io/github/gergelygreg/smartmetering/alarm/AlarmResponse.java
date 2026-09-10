package io.github.gergelygreg.smartmetering.alarm;

import java.math.BigDecimal;
import java.time.Instant;

public record AlarmResponse(
        String id,
        String meterId,
        String sourceReadingId,
        AlarmType type,
        AlarmSeverity severity,
        AlarmStatus status,
        Instant detectedAt,
        BigDecimal actualValue,
        BigDecimal threshold,
        Instant acknowledgedAt
) {
}
