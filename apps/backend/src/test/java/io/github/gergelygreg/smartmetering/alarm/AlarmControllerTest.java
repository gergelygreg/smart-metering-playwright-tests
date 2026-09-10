package io.github.gergelygreg.smartmetering.alarm;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import io.github.gergelygreg.smartmetering.error.ApiExceptionHandler;
import io.github.gergelygreg.smartmetering.meter.MeterNotFoundException;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AlarmController.class)
@Import(ApiExceptionHandler.class)
class AlarmControllerTest {
    @Autowired private MockMvc mockMvc;
    @MockitoBean private AlarmService alarmService;

    @Test
    void listsMeterAlarms() throws Exception {
        when(alarmService.getAlarms("meter-123")).thenReturn(List.of(activeAlarm()));
        mockMvc.perform(get("/api/meters/meter-123/alarms"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("HIGH_VOLTAGE"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));
    }

    @Test
    void returnsAlarmById() throws Exception {
        when(alarmService.getAlarm("meter-123", "alarm-123")).thenReturn(activeAlarm());
        mockMvc.perform(get("/api/meters/meter-123/alarms/alarm-123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("alarm-123"))
                .andExpect(jsonPath("$.sourceReadingId").value("reading-123"))
                .andExpect(jsonPath("$.threshold").value(253.0));
    }

    @Test
    void unknownAlarmReturnsStructuredProblem() throws Exception {
        when(alarmService.getAlarm("meter-123", "missing-alarm")).thenThrow(new AlarmNotFoundException());
        mockMvc.perform(get("/api/meters/meter-123/alarms/missing-alarm"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("ALARM_NOT_FOUND"))
                .andExpect(jsonPath("$.detail").value("Meter alarm not found."));
    }

    @Test
    void acknowledgesAlarm() throws Exception {
        AlarmResponse acknowledged = new AlarmResponse(
                "alarm-123", "meter-123", "reading-123",
                AlarmType.HIGH_VOLTAGE, AlarmSeverity.WARNING, AlarmStatus.ACKNOWLEDGED,
                Instant.parse("2026-01-01T12:00:00Z"), new BigDecimal("260.0"),
                new BigDecimal("253.0"), Instant.parse("2026-01-01T12:05:00Z")
        );
        when(alarmService.acknowledgeAlarm("meter-123", "alarm-123")).thenReturn(acknowledged);
        mockMvc.perform(post("/api/meters/meter-123/alarms/alarm-123/acknowledge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACKNOWLEDGED"))
                .andExpect(jsonPath("$.acknowledgedAt").value("2026-01-01T12:05:00Z"));
    }

    @Test
    void unknownMeterKeepsMeterNotFoundContract() throws Exception {
        when(alarmService.getAlarms("missing-meter")).thenThrow(new MeterNotFoundException());
        mockMvc.perform(get("/api/meters/missing-meter/alarms"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("METER_NOT_FOUND"));
    }

    private AlarmResponse activeAlarm() {
        return new AlarmResponse(
                "alarm-123", "meter-123", "reading-123",
                AlarmType.HIGH_VOLTAGE, AlarmSeverity.WARNING, AlarmStatus.ACTIVE,
                Instant.parse("2026-01-01T12:00:00Z"), new BigDecimal("260.0"),
                new BigDecimal("253.0"), null
        );
    }
}
