package io.github.gergelygreg.smartmetering.meterreading;

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

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MeterReadingController.class)
@Import(ApiExceptionHandler.class)
class MeterReadingListControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MeterReadingService meterReadingService;

    @Test
    void returnsEmptyReadingList() throws Exception {
        when(meterReadingService.getReadings("meter-123"))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/meters/meter-123/readings"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.length()").value(0));

        verify(meterReadingService).getReadings("meter-123");
    }

    @Test
    void returnsMeterReadingHistory() throws Exception {
        MeterReadingResponse first = new MeterReadingResponse(
                "reading-001",
                "meter-123",
                Instant.parse("2026-01-01T12:00:00Z"),
                new BigDecimal("230.0"),
                new BigDecimal("4.2"),
                new BigDecimal("966.0"),
                new BigDecimal("12543.8")
        );

        MeterReadingResponse second = new MeterReadingResponse(
                "reading-002",
                "meter-123",
                Instant.parse("2026-01-01T12:15:00Z"),
                new BigDecimal("231.5"),
                new BigDecimal("4.5"),
                new BigDecimal("1041.8"),
                new BigDecimal("12544.1")
        );

        when(meterReadingService.getReadings("meter-123"))
                .thenReturn(List.of(first, second));

        mockMvc.perform(get("/api/meters/meter-123/readings"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("reading-001"))
                .andExpect(jsonPath("$[0].meterId").value("meter-123"))
                .andExpect(jsonPath("$[0].voltage").value(230.0))
                .andExpect(jsonPath("$[1].id").value("reading-002"))
                .andExpect(jsonPath("$[1].meterId").value("meter-123"))
                .andExpect(jsonPath("$[1].voltage").value(231.5));

        verify(meterReadingService).getReadings("meter-123");
    }

    @Test
    void unknownMeterReturnsStructuredNotFoundProblem()
            throws Exception {

        when(meterReadingService.getReadings("missing-meter"))
                .thenThrow(new MeterNotFoundException());

        mockMvc.perform(get(
                        "/api/meters/missing-meter/readings"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Not Found"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value(
                        "Meter not found."))
                .andExpect(jsonPath("$.code").value(
                        "METER_NOT_FOUND"))
                .andExpect(jsonPath("$.instance").value(
                        "/api/meters/missing-meter/readings"));

        verify(meterReadingService).getReadings(
                "missing-meter"
        );
    }
}
