package io.github.gergelygreg.smartmetering.meter;

public record MeterResponse(
        String id,
        String serialNumber,
        MeterStatus status,
        String firmwareVersion
) {
}