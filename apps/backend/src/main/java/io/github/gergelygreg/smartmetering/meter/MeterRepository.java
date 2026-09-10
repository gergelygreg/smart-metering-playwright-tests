package io.github.gergelygreg.smartmetering.meter;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MeterRepository extends JpaRepository<MeterEntity, String> {
    boolean existsBySerialNumber(String serialNumber);
}
