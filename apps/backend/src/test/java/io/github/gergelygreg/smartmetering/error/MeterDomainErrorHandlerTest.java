package io.github.gergelygreg.smartmetering.error;

import io.github.gergelygreg.smartmetering.meter.CreateMeterRequest;
import io.github.gergelygreg.smartmetering.meter.MeterController;
import io.github.gergelygreg.smartmetering.meter.MeterNotFoundException;
import io.github.gergelygreg.smartmetering.meter.MeterSerialConflictException;
import io.github.gergelygreg.smartmetering.meter.MeterService;
import io.github.gergelygreg.smartmetering.meter.MeterLifecycleService;
import io.github.gergelygreg.smartmetering.meter.MeterStatus;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MeterController.class)
@Import(ApiExceptionHandler.class)
class MeterDomainErrorHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MeterService meterService;

    @MockitoBean
    private MeterLifecycleService meterLifecycleService;

    @Test
    void unknownMeterReturnsStructuredNotFoundProblem() throws Exception {
        when(meterService.getMeterById("missing-meter"))
                .thenThrow(new MeterNotFoundException());

        mockMvc.perform(get("/api/meters/missing-meter"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Not Found"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Meter not found."))
                .andExpect(jsonPath("$.instance").value("/api/meters/missing-meter"))
                .andExpect(jsonPath("$.code").value("METER_NOT_FOUND"));

        verify(meterService).getMeterById("missing-meter");
    }

    @Test
    void duplicateSerialReturnsStructuredConflictProblem() throws Exception {
        CreateMeterRequest request = new CreateMeterRequest(
                "SN-DOMAIN-001",
                MeterStatus.ONLINE,
                "1.0.0"
        );

        when(meterService.createMeter(request))
                .thenThrow(new MeterSerialConflictException());

        mockMvc.perform(post("/api/meters")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "serialNumber": "SN-DOMAIN-001",
                                  "status": "ONLINE",
                                  "firmwareVersion": "1.0.0"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Conflict"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value(
                        "A meter with this serial number already exists."))
                .andExpect(jsonPath("$.instance").value("/api/meters"))
                .andExpect(jsonPath("$.code").value("METER_SERIAL_CONFLICT"));

        verify(meterService).createMeter(request);
    }
}