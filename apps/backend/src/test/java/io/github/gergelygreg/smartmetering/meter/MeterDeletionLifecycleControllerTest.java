package io.github.gergelygreg.smartmetering.meter;

import io.github.gergelygreg.smartmetering.error.ApiExceptionHandler;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MeterController.class)
@Import(ApiExceptionHandler.class)
class MeterDeletionLifecycleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MeterService meterService;

    @MockitoBean
    private MeterLifecycleService meterLifecycleService;

    @Test
    void delegatesMeterDeletionToLifecycleService()
            throws Exception {

        mockMvc.perform(delete("/api/meters/meter-123"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(meterLifecycleService)
                .deleteMeter("meter-123");

        verifyNoInteractions(meterService);
    }

    @Test
    void preservesStructuredNotFoundContractFromLifecycleService()
            throws Exception {

        doThrow(new MeterNotFoundException())
                .when(meterLifecycleService)
                .deleteMeter("missing-meter");

        mockMvc.perform(delete("/api/meters/missing-meter"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(
                        "application/problem+json"))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Not Found"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value(
                        "Meter not found."))
                .andExpect(jsonPath("$.code").value(
                        "METER_NOT_FOUND"))
                .andExpect(jsonPath("$.instance").value(
                        "/api/meters/missing-meter"));

        verify(meterLifecycleService)
                .deleteMeter("missing-meter");

        verifyNoInteractions(meterService);
    }
}
