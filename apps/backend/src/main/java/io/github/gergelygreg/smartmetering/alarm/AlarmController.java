package io.github.gergelygreg.smartmetering.alarm;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/meters/{meterId}/alarms")
public class AlarmController {

    private final AlarmService alarmService;

    public AlarmController(AlarmService alarmService) {
        this.alarmService = alarmService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<AlarmResponse>> getAlarms(@PathVariable String meterId) {
        return ResponseEntity.ok(alarmService.getAlarms(meterId));
    }

    @GetMapping(value = "/{alarmId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AlarmResponse> getAlarm(
            @PathVariable String meterId,
            @PathVariable String alarmId
    ) {
        return ResponseEntity.ok(alarmService.getAlarm(meterId, alarmId));
    }

    @PostMapping(value = "/{alarmId}/acknowledge", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AlarmResponse> acknowledgeAlarm(
            @PathVariable String meterId,
            @PathVariable String alarmId
    ) {
        return ResponseEntity.ok(alarmService.acknowledgeAlarm(meterId, alarmId));
    }
}
