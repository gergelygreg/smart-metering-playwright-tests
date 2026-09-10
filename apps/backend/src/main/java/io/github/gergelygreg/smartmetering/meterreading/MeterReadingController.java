package io.github.gergelygreg.smartmetering.meterreading;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/meters/{meterId}/readings")
public class MeterReadingController {

    private final MeterReadingService meterReadingService;

    public MeterReadingController(
            MeterReadingService meterReadingService
    ) {
        this.meterReadingService = meterReadingService;
    }

    @PostMapping(
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<MeterReadingResponse> createReading(
            @PathVariable String meterId,
            @Valid @RequestBody CreateReadingRequest request
    ) {
        MeterReadingResponse reading =
                meterReadingService.createReading(meterId, request);

        URI location = URI.create(
                "/api/meters/" +
                meterId +
                "/readings/" +
                reading.id()
        );

        return ResponseEntity
                .created(location)
                .body(reading);
    }

    @GetMapping(
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<List<MeterReadingResponse>> getReadings(
            @PathVariable String meterId
    ) {
        return ResponseEntity.ok(
                meterReadingService.getReadings(meterId)
        );
    }

    @GetMapping(
            value = "/{readingId}",
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<MeterReadingResponse> getReading(
            @PathVariable String meterId,
            @PathVariable String readingId
    ) {
        return ResponseEntity.ok(
                meterReadingService.getReading(
                        meterId,
                        readingId
                )
        );
    }
}
