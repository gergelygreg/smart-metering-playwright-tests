package io.github.gergelygreg.smartmetering.health;

public record HealthResponse(
        String status,
        String service
) {
}