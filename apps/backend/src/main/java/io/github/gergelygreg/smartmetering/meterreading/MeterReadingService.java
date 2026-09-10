package io.github.gergelygreg.smartmetering.meterreading;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import io.github.gergelygreg.smartmetering.meter.MeterService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MeterReadingService {

    private final MeterService meterService;
    private final MeterReadingRepository meterReadingRepository;

    public MeterReadingService(
            MeterService meterService,
            MeterReadingRepository meterReadingRepository
    ) {
        this.meterService = meterService;
        this.meterReadingRepository = meterReadingRepository;
    }

    @Transactional
    public MeterReadingResponse createReading(
            String meterId,
            CreateReadingRequest request
    ) {
        meterService.getMeterById(meterId);

        MeterReadingEntity entity = new MeterReadingEntity(
                UUID.randomUUID().toString(),
                meterId,
                request.timestamp().truncatedTo(ChronoUnit.MICROS),
                request.voltage(),
                request.current(),
                request.activePower(),
                request.energyKwh()
        );

        return toResponse(meterReadingRepository.saveAndFlush(entity));
    }

    @Transactional(readOnly = true)
    public List<MeterReadingResponse> getReadings(String meterId) {
        meterService.getMeterById(meterId);

        return meterReadingRepository.findAllByMeterId(meterId)
                .stream()
                .map(MeterReadingService::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MeterReadingResponse getReading(
            String meterId,
            String readingId
    ) {
        meterService.getMeterById(meterId);

        return meterReadingRepository
                .findByIdAndMeterId(readingId, meterId)
                .map(MeterReadingService::toResponse)
                .orElseThrow(MeterReadingNotFoundException::new);
    }

    @Transactional
    public void deleteReadingsForMeter(String meterId) {
        meterReadingRepository.deleteByMeterId(meterId);
    }

    private static BigDecimal normalizeDecimal(BigDecimal value) {
        BigDecimal normalized = value.stripTrailingZeros();

        return normalized.scale() < 0
                ? normalized.setScale(0)
                : normalized;
    }

    private static MeterReadingResponse toResponse(MeterReadingEntity entity) {
        return new MeterReadingResponse(
                entity.getId(),
                entity.getMeterId(),
                entity.getTimestamp(),
                normalizeDecimal(entity.getVoltage()),
                normalizeDecimal(entity.getCurrent()),
                normalizeDecimal(entity.getActivePower()),
                normalizeDecimal(entity.getEnergyKwh())
        );
    }
}
