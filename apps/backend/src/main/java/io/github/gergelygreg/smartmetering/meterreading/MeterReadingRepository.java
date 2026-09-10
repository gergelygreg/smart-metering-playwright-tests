package io.github.gergelygreg.smartmetering.meterreading;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MeterReadingRepository extends JpaRepository<MeterReadingEntity, String> {
    List<MeterReadingEntity> findAllByMeterId(String meterId);
    Optional<MeterReadingEntity> findByIdAndMeterId(String id, String meterId);
    long deleteByMeterId(String meterId);
}
