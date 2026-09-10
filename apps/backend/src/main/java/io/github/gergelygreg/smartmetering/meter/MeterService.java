package io.github.gergelygreg.smartmetering.meter;

import java.util.List;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MeterService {

    private final MeterRepository meterRepository;

    public MeterService(MeterRepository meterRepository) {
        this.meterRepository = meterRepository;
    }

    @Transactional
    public MeterResponse createMeter(CreateMeterRequest request) {
        if (meterRepository.existsBySerialNumber(request.serialNumber())) {
            throw new MeterSerialConflictException();
        }

        MeterEntity entity = new MeterEntity(
                UUID.randomUUID().toString(),
                request.serialNumber(),
                request.status(),
                request.firmwareVersion()
        );

        try {
            return toResponse(meterRepository.saveAndFlush(entity));
        }
        catch (DataIntegrityViolationException exception) {
            throw new MeterSerialConflictException();
        }
    }

    @Transactional(readOnly = true)
    public MeterResponse getMeterById(String id) {
        return meterRepository.findById(id)
                .map(MeterService::toResponse)
                .orElseThrow(MeterNotFoundException::new);
    }

    @Transactional(readOnly = true)
    public List<MeterResponse> getAllMeters() {
        return meterRepository.findAll().stream()
                .map(MeterService::toResponse)
                .toList();
    }

    @Transactional
    public void deleteMeter(String id) {
        MeterEntity entity = meterRepository.findById(id)
                .orElseThrow(MeterNotFoundException::new);
        meterRepository.delete(entity);
    }

    private static MeterResponse toResponse(MeterEntity entity) {
        return new MeterResponse(
                entity.getId(),
                entity.getSerialNumber(),
                entity.getStatus(),
                entity.getFirmwareVersion()
        );
    }
}
