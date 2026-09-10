package io.github.gergelygreg.smartmetering.meterreading;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class MeterReadingNotFoundException
        extends ResponseStatusException {

    public MeterReadingNotFoundException() {
        super(
                HttpStatus.NOT_FOUND,
                "Meter reading not found."
        );
    }
}
