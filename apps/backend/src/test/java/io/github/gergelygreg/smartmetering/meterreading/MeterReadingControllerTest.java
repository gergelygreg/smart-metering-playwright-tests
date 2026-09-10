package io.github.gergelygreg.smartmetering.meterreading;

import java.math.BigDecimal;
import java.time.Instant;

import io.github.gergelygreg.smartmetering.error.ApiExceptionHandler;
import io.github.gergelygreg.smartmetering.meter.MeterNotFoundException;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MeterReadingController.class)
@Import(ApiExceptionHandler.class)
class MeterReadingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MeterReadingService meterReadingService;

    @Test
    void createReadingReturns201AndLocation() throws Exception {
        CreateReadingRequest request = new CreateReadingRequest(
                Instant.parse("2026-01-01T12:00:00Z"),
                new BigDecimal("230.0"),
                new BigDecimal("4.2"),
                new BigDecimal("966.0"),
                new BigDecimal("12543.8")
        );

        MeterReadingResponse reading = new MeterReadingResponse(
                "reading-123",
                "meter-123",
                request.timestamp(),
                request.voltage(),
                request.current(),
                request.activePower(),
                request.energyKwh()
        );

        when(meterReadingService.createReading(
                "meter-123",
                request
        )).thenReturn(reading);

        mockMvc.perform(post(
                        "/api/meters/meter-123/readings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "timestamp": "2026-01-01T12:00:00Z",
                                  "voltage": 230.0,
                                  "current": 4.2,
                                  "activePower": 966.0,
                                  "energyKwh": 12543.8
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON))
                .andExpect(header().string(
                        "Location",
                        "/api/meters/meter-123/readings/reading-123"
                ))
                .andExpect(jsonPath("$.id").value("reading-123"))
                .andExpect(jsonPath("$.meterId").value("meter-123"))
                .andExpect(jsonPath("$.timestamp").value(
                        "2026-01-01T12:00:00Z"))
                .andExpect(jsonPath("$.voltage").value(230.0))
                .andExpect(jsonPath("$.current").value(4.2))
                .andExpect(jsonPath("$.activePower").value(966.0))
                .andExpect(jsonPath("$.energyKwh").value(12543.8));

        verify(meterReadingService).createReading(
                "meter-123",
                request
        );
    }

    @Test
    void missingTimestampReturnsValidationProblem() throws Exception {
        mockMvc.perform(post(
                        "/api/meters/meter-123/readings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "voltage": 230.0,
                                  "current": 4.2,
                                  "activePower": 966.0,
                                  "energyKwh": 12543.8
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value(
                        "VALIDATION_ERROR"))
                .andExpect(jsonPath(
                        "$.errors[?(@.field == 'timestamp')].code"
                ).value("REQUIRED"));

        verifyNoInteractions(meterReadingService);
    }

    @Test
    void unknownMeterReturnsStructuredNotFoundProblem()
            throws Exception {

        CreateReadingRequest request = new CreateReadingRequest(
                Instant.parse("2026-01-01T12:00:00Z"),
                new BigDecimal("230.0"),
                new BigDecimal("4.2"),
                new BigDecimal("966.0"),
                new BigDecimal("12543.8")
        );

        when(meterReadingService.createReading(
                "missing-meter",
                request
        )).thenThrow(new MeterNotFoundException());

        mockMvc.perform(post(
                        "/api/meters/missing-meter/readings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "timestamp": "2026-01-01T12:00:00Z",
                                  "voltage": 230.0,
                                  "current": 4.2,
                                  "activePower": 966.0,
                                  "energyKwh": 12543.8
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value(
                        "METER_NOT_FOUND"))
                .andExpect(jsonPath("$.instance").value(
                        "/api/meters/missing-meter/readings"));

        verify(meterReadingService).createReading(
                "missing-meter",
                request
        );
    }
}
