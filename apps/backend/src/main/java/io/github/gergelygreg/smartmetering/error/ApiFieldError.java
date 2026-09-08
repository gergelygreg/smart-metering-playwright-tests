package io.github.gergelygreg.smartmetering.error;

public record ApiFieldError(
        String field,
        String code
) {
}