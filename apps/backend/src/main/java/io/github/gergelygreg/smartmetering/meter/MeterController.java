package io.github.gergelygreg.smartmetering.meter;

import java.net.URI;

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
@RequestMapping("/api/meters")
public class MeterController {

    private final MeterService meterService;

    public MeterController(MeterService meterService) {
        this.meterService = meterService;
    }

    @PostMapping(
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<MeterResponse> createMeter(
            @Valid @RequestBody CreateMeterRequest request
    ) {
        MeterResponse meter = meterService.createMeter(request);

        URI location = URI.create("/api/meters/" + meter.id());

        return ResponseEntity
                .created(location)
                .body(meter);
    }

    @GetMapping("/{id}")
    public ResponseEntity<MeterResponse> getMeterById(
            @PathVariable String id
    ) {
        MeterResponse meter = meterService.getMeterById(id);

        return ResponseEntity.ok(meter);
    }
}
