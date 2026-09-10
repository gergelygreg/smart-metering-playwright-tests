package io.github.gergelygreg.smartmetering.alarm;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlarmRepository extends JpaRepository<AlarmEntity, String> {
    List<AlarmEntity> findAllByMeterId(String meterId);
    Optional<AlarmEntity> findByIdAndMeterId(String id, String meterId);
    long deleteByMeterId(String meterId);
}
