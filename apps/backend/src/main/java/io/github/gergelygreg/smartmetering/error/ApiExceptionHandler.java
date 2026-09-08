package io.github.gergelygreg.smartmetering.error;

import java.net.URI;
import java.util.Comparator;
import java.util.List;

import io.github.gergelygreg.smartmetering.meter.MeterNotFoundException;
import io.github.gergelygreg.smartmetering.meter.MeterSerialConflictException;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        List<ApiFieldError> errors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(ApiExceptionHandler::toFieldError)
                .sorted(Comparator.comparing(ApiFieldError::field)
                        .thenComparing(ApiFieldError::code))
                .toList();

        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setType(URI.create("about:blank"));
        problem.setTitle("Bad Request");
        problem.setDetail("Request validation failed.");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", "VALIDATION_ERROR");
        problem.setProperty("errors", errors);

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(problem);
    }

    private static ApiFieldError toFieldError(FieldError error) {
        String validationCode = error.getCode();

        String code = "NotBlank".equals(validationCode)
                || "NotNull".equals(validationCode)
                ? "REQUIRED"
                : "INVALID_VALUE";

        return new ApiFieldError(error.getField(), code);
    }

    @ExceptionHandler(MeterNotFoundException.class)
    public ResponseEntity<ProblemDetail> handleMeterNotFound(
            MeterNotFoundException exception,
            HttpServletRequest request
    ) {
        return domainProblem(exception, "METER_NOT_FOUND", request);
    }

    @ExceptionHandler(MeterSerialConflictException.class)
    public ResponseEntity<ProblemDetail> handleMeterSerialConflict(
            MeterSerialConflictException exception,
            HttpServletRequest request
    ) {
        return domainProblem(exception, "METER_SERIAL_CONFLICT", request);
    }

    private ResponseEntity<ProblemDetail> domainProblem(
            ResponseStatusException exception,
            String code,
            HttpServletRequest request
    ) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                exception.getStatusCode(),
                exception.getReason()
        );

        problem.setType(URI.create("about:blank"));
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);

        return ResponseEntity
                .status(exception.getStatusCode())
                .headers(exception.getHeaders())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(problem);
    }
}
