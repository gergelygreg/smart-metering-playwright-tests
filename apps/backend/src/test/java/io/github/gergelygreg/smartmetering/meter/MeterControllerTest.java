package io.github.gergelygreg.smartmetering.meter;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MeterController.class)
class MeterControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MeterService meterService;

    @Test
    void shouldReturnCreatedMeterAndLocationHeader() throws Exception {
        MeterResponse meter = new MeterResponse(
                "meter-123",
                "SN-MVC-001",
                MeterStatus.ONLINE,
                "1.0.0"
        );

        when(meterService.createMeter(any(CreateMeterRequest.class)))
                .thenReturn(meter);

        mockMvc.perform(post("/api/meters")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "serialNumber": "SN-MVC-001",
                                  "status": "ONLINE",
                                  "firmwareVersion": "1.0.0"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string(
                        "Location",
                        "/api/meters/meter-123"
                ))
                .andExpect(jsonPath("$.id").value("meter-123"))
                .andExpect(jsonPath("$.serialNumber").value("SN-MVC-001"))
                .andExpect(jsonPath("$.status").value("ONLINE"))
                .andExpect(jsonPath("$.firmwareVersion").value("1.0.0"));

        verify(meterService).createMeter(any(CreateMeterRequest.class));
    }

    @Test
    void shouldReturnBadRequestWhenSerialNumberIsBlank() throws Exception {
        mockMvc.perform(post("/api/meters")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "serialNumber": "",
                                  "status": "ONLINE",
                                  "firmwareVersion": "1.0.0"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(meterService);
    }

    @Test
    void shouldReturnBadRequestWhenStatusIsMissing() throws Exception {
        mockMvc.perform(post("/api/meters")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "serialNumber": "SN-MVC-002",
                                  "firmwareVersion": "1.0.0"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(meterService);
    }

    @Test
    void shouldReturnConflictWhenServiceRejectsDuplicate() throws Exception {
        when(meterService.createMeter(any(CreateMeterRequest.class)))
                .thenThrow(new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "A meter with this serial number already exists."
                ));

        mockMvc.perform(post("/api/meters")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "serialNumber": "SN-MVC-DUPLICATE",
                                  "status": "ONLINE",
                                  "firmwareVersion": "1.0.0"
                                }
                                """))
                .andExpect(status().isConflict());
    }
}