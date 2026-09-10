package io.github.gergelygreg.smartmetering.meterreading;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import io.github.gergelygreg.smartmetering.meter.MeterService;

import org.springframework.stereotype.Service;

@Service
public class MeterReadingService {

    private final MeterService meterService;

    private final ConcurrentMap<
            String,
            ConcurrentMap<String, MeterReadingResponse>
    > readingsByMeterId = new ConcurrentHashMap<>();

    public MeterReadingService(MeterService meterService) {
        this.meterService = meterService;
    }

    public MeterReadingResponse createReading(
            String meterId,
            CreateReadingRequest request
    ) {
        meterService.getMeterById(meterId);

        MeterReadingResponse reading = new MeterReadingResponse(
                UUID.randomUUID().toString(),
                meterId,
                request.timestamp(),
                request.voltage(),
                request.current(),
                request.activePower(),
                request.energyKwh()
        );

        readingsByMeterId
                .computeIfAbsent(
                        meterId,
                        ignored -> new ConcurrentHashMap<>()
                )
                .put(reading.id(), reading);

        return reading;
    }

    public List<MeterReadingResponse> getReadings(String meterId) {
        meterService.getMeterById(meterId);

        ConcurrentMap<String, MeterReadingResponse> readings =
                readingsByMeterId.get(meterId);

        if (readings == null) {
            return List.of();
        }

        return List.copyOf(readings.values());
    }

    public MeterReadingResponse getReading(
            String meterId,
            String readingId
    ) {
        meterService.getMeterById(meterId);

        ConcurrentMap<String, MeterReadingResponse> readings =
                readingsByMeterId.get(meterId);

        if (readings == null) {
            throw new MeterReadingNotFoundException();
        }

        MeterReadingResponse reading = readings.get(readingId);

        if (reading == null) {
            throw new MeterReadingNotFoundException();
        }

        return reading;
    }

    public void deleteReadingsForMeter(String meterId) {
        readingsByMeterId.remove(meterId);
    }
}
