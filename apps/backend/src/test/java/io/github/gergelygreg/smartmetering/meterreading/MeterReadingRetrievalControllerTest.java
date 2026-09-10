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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MeterReadingController.class)
@Import(ApiExceptionHandler.class)
class MeterReadingRetrievalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MeterReadingService meterReadingService;

    @MockitoBean
    private MeterReadingLifecycleService meterReadingLifecycleService;

    @Test
    void returnsReadingById() throws Exception {
        MeterReadingResponse reading =
                new MeterReadingResponse(
                        "reading-123",
                        "meter-123",
                        Instant.parse("2026-01-01T12:00:00Z"),
                        new BigDecimal("230.0"),
                        new BigDecimal("4.2"),
                        new BigDecimal("966.0"),
                        new BigDecimal("12543.8")
                );

        when(meterReadingService.getReading(
                "meter-123",
                "reading-123"
        )).thenReturn(reading);

        mockMvc.perform(get(
                        "/api/meters/meter-123/readings/reading-123"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id").value("reading-123"))
                .andExpect(jsonPath("$.meterId").value("meter-123"))
                .andExpect(jsonPath("$.timestamp").value(
                        "2026-01-01T12:00:00Z"))
                .andExpect(jsonPath("$.voltage").value(230.0))
                .andExpect(jsonPath("$.current").value(4.2))
                .andExpect(jsonPath("$.activePower").value(966.0))
                .andExpect(jsonPath("$.energyKwh").value(12543.8));

        verify(meterReadingService).getReading(
                "meter-123",
                "reading-123"
        );
    }

    @Test
    void unknownReadingReturnsStructuredProblem()
            throws Exception {

        when(meterReadingService.getReading(
                "meter-123",
                "missing-reading"
        )).thenThrow(new MeterReadingNotFoundException());

        mockMvc.perform(get(
                        "/api/meters/meter-123/readings/missing-reading"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Not Found"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value(
                        "Meter reading not found."))
                .andExpect(jsonPath("$.code").value(
                        "READING_NOT_FOUND"))
                .andExpect(jsonPath("$.instance").value(
                        "/api/meters/meter-123/readings/missing-reading"));

        verify(meterReadingService).getReading(
                "meter-123",
                "missing-reading"
        );
    }

    @Test
    void readingFromAnotherMeterReturnsStructuredProblem()
            throws Exception {

        when(meterReadingService.getReading(
                "other-meter",
                "reading-123"
        )).thenThrow(new MeterReadingNotFoundException());

        mockMvc.perform(get(
                        "/api/meters/other-meter/readings/reading-123"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value(
                        "READING_NOT_FOUND"))
                .andExpect(jsonPath("$.instance").value(
                        "/api/meters/other-meter/readings/reading-123"));

        verify(meterReadingService).getReading(
                "other-meter",
                "reading-123"
        );
    }

    @Test
    void unknownMeterKeepsMeterNotFoundContract()
            throws Exception {

        when(meterReadingService.getReading(
                "missing-meter",
                "reading-123"
        )).thenThrow(new MeterNotFoundException());

        mockMvc.perform(get(
                        "/api/meters/missing-meter/readings/reading-123"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value(
                        "METER_NOT_FOUND"));

        verify(meterReadingService).getReading(
                "missing-meter",
                "reading-123"
        );
    }
}
