package io.github.gergelygreg.smartmetering.meter;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MeterController.class)
class MeterListControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MeterService meterService;

    @Test
    void getAllMetersReturnsEmptyJsonArray() throws Exception {
        when(meterService.getAllMeters()).thenReturn(List.of());

        mockMvc.perform(get("/api/meters"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.length()").value(0));

        verify(meterService).getAllMeters();
    }

    @Test
    void getAllMetersReturnsMeterResponseList() throws Exception {
        MeterResponse meter = new MeterResponse(
                "meter-123",
                "SN-LIST-001",
                MeterStatus.ONLINE,
                "1.0.0"
        );

        when(meterService.getAllMeters()).thenReturn(List.of(meter));

        mockMvc.perform(get("/api/meters"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("meter-123"))
                .andExpect(jsonPath("$[0].serialNumber").value("SN-LIST-001"))
                .andExpect(jsonPath("$[0].status").value("ONLINE"))
                .andExpect(jsonPath("$[0].firmwareVersion").value("1.0.0"));

        verify(meterService).getAllMeters();
    }
}