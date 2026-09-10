package io.github.gergelygreg.smartmetering.meter;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MeterController.class)
class MeterRetrievalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MeterService meterService;

    @MockitoBean
    private MeterLifecycleService meterLifecycleService;

    @Test
    void shouldReturnMeterById() throws Exception {
        MeterResponse meter = new MeterResponse(
                "meter-123",
                "SN-MVC-RETRIEVAL",
                MeterStatus.ONLINE,
                "1.0.0"
        );

        when(meterService.getMeterById("meter-123"))
                .thenReturn(meter);

        mockMvc.perform(get("/api/meters/meter-123"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON
                ))
                .andExpect(jsonPath("$.id").value("meter-123"))
                .andExpect(jsonPath("$.serialNumber").value(
                        "SN-MVC-RETRIEVAL"
                ))
                .andExpect(jsonPath("$.status").value("ONLINE"))
                .andExpect(jsonPath("$.firmwareVersion").value("1.0.0"));

        verify(meterService).getMeterById("meter-123");
    }

    @Test
    void shouldReturnNotFoundWhenMeterDoesNotExist() throws Exception {
        when(meterService.getMeterById("unknown-meter"))
                .thenThrow(new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Meter not found."
                ));

        mockMvc.perform(get("/api/meters/unknown-meter"))
                .andExpect(status().isNotFound());

        verify(meterService).getMeterById("unknown-meter");
    }
}