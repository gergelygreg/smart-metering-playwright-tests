package io.github.gergelygreg.smartmetering.meter;

import java.util.UUID;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MeterService {

    private final ConcurrentMap<String, MeterResponse> metersBySerialNumber =
            new ConcurrentHashMap<>();

    public MeterResponse createMeter(CreateMeterRequest request) {
        MeterResponse meter = new MeterResponse(
                UUID.randomUUID().toString(),
                request.serialNumber(),
                request.status(),
                request.firmwareVersion()
        );

        MeterResponse existing = metersBySerialNumber.putIfAbsent(
                meter.serialNumber(),
                meter
        );

        if (existing != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A meter with this serial number already exists."
            );
        }

        return meter;
    }

    public MeterResponse getMeterById(String id) {
        return metersBySerialNumber.values()
                .stream()
                .filter(meter -> meter.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Meter not found."
                ));
    }

    public List<MeterResponse> getAllMeters() {
        return List.copyOf(metersBySerialNumber.values());
    }
}
