package io.github.gergelygreg.smartmetering.meter;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class MeterSerialConflictException extends ResponseStatusException {

    public MeterSerialConflictException() {
        super(
                HttpStatus.CONFLICT,
                "A meter with this serial number already exists."
        );
    }
}