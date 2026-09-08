package io.github.gergelygreg.smartmetering.meter;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class MeterNotFoundException extends ResponseStatusException {

    public MeterNotFoundException() {
        super(HttpStatus.NOT_FOUND, "Meter not found.");
    }
}