package io.github.gergelygreg.smartmetering.alarm;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class AlarmNotFoundException extends ResponseStatusException {

    public AlarmNotFoundException() {
        super(HttpStatus.NOT_FOUND, "Meter alarm not found.");
    }
}
