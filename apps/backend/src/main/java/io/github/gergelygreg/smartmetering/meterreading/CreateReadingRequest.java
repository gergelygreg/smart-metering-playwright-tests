package io.github.gergelygreg.smartmetering.meterreading;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public record CreateReadingRequest(
        @NotNull Instant timestamp,
        @NotNull @Positive BigDecimal voltage,
        @NotNull @PositiveOrZero BigDecimal current,
        @NotNull BigDecimal activePower,
        @NotNull @PositiveOrZero BigDecimal energyKwh
) {
}
