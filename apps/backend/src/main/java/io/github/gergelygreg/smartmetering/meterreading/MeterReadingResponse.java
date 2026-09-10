package io.github.gergelygreg.smartmetering.meterreading;

import java.math.BigDecimal;
import java.time.Instant;

public record MeterReadingResponse(
        String id,
        String meterId,
        Instant timestamp,
        BigDecimal voltage,
        BigDecimal current,
        BigDecimal activePower,
        BigDecimal energyKwh
) {
}
