package io.github.gergelygreg.smartmetering.error;

import io.github.gergelygreg.smartmetering.config.StrictJsonConfig;
import io.github.gergelygreg.smartmetering.meter.CreateMeterRequest;
import io.github.gergelygreg.smartmetering.meter.MeterController;
import io.github.gergelygreg.smartmetering.meter.MeterResponse;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MeterController.class)
@Import({ApiExceptionHandler.class, StrictJsonConfig.class})
class MeterRequestBodyHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MeterService meterService;

    @MockitoBean
    private MeterLifecycleService meterLifecycleService;

    private void assertInvalidBody(String json) throws Exception {
        mockMvc.perform(post("/api/meters")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value(
                        "Request body is invalid."))
                .andExpect(jsonPath("$.instance").value("/api/meters"))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST_BODY"));

        verifyNoInteractions(meterService);
    }

    @Test
    void malformedJsonReturnsStructuredProblem() throws Exception {
        assertInvalidBody("""
                {"serialNumber":"SN-BODY-001","status":"ONLINE",
                """);
    }

    @Test
    void unknownEnumReturnsStructuredProblem() throws Exception {
        assertInvalidBody("""
                {
                  "serialNumber": "SN-BODY-002",
                  "status": "DISCONNECTED",
                  "firmwareVersion": "1.0.0"
                }
                """);
    }

    @Test
    void numericFirmwareVersionReturnsStructuredProblem() throws Exception {
        assertInvalidBody("""
                {
                  "serialNumber": "SN-BODY-003",
                  "status": "ONLINE",
                  "firmwareVersion": 123
                }
                """);
    }

    @Test
    void validStringFirmwareVersionStillCreatesMeter() throws Exception {
        CreateMeterRequest request = new CreateMeterRequest(
                "SN-BODY-004",
                MeterStatus.ONLINE,
                "1.0.0"
        );

        MeterResponse meter = new MeterResponse(
                "meter-valid-001",
                request.serialNumber(),
                request.status(),
                request.firmwareVersion()
        );

        when(meterService.createMeter(request)).thenReturn(meter);

        mockMvc.perform(post("/api/meters")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "serialNumber": "SN-BODY-004",
                                  "status": "ONLINE",
                                  "firmwareVersion": "1.0.0"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("meter-valid-001"))
                .andExpect(jsonPath("$.firmwareVersion").value("1.0.0"));

        verify(meterService).createMeter(request);
    }
}