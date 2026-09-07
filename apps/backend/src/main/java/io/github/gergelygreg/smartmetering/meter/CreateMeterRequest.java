package io.github.gergelygreg.smartmetering.meter;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateMeterRequest(
        @NotBlank String serialNumber,
        @NotNull MeterStatus status,
        @NotBlank String firmwareVersion
) {
}