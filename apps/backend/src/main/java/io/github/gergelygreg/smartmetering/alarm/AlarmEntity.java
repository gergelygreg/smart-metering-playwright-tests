package io.github.gergelygreg.smartmetering.alarm;

import java.math.BigDecimal;
import java.time.Instant;
import jakarta.persistence.*;

@Entity
@Table(name = "alarms")
public class AlarmEntity {
    @Id
    @Column(nullable = false, length = 36)
    private String id;

    @Column(name = "meter_id", nullable = false, length = 36)
    private String meterId;

    @Column(name = "source_reading_id", nullable = false, length = 36)
    private String sourceReadingId;

    @Enumerated(EnumType.STRING)
    @Column(name = "alarm_type", nullable = false, length = 64)
    private AlarmType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AlarmSeverity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AlarmStatus status;

    @Column(name = "detected_at", nullable = false)
    private Instant detectedAt;

    @Column(name = "actual_value", nullable = false, precision = 19, scale = 6)
    private BigDecimal actualValue;

    @Column(name = "threshold_value", nullable = false, precision = 19, scale = 6)
    private BigDecimal threshold;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    protected AlarmEntity() {}

    public AlarmEntity(String id, String meterId, String sourceReadingId, AlarmType type,
                       AlarmSeverity severity, AlarmStatus status, Instant detectedAt,
                       BigDecimal actualValue, BigDecimal threshold, Instant acknowledgedAt) {
        this.id = id;
        this.meterId = meterId;
        this.sourceReadingId = sourceReadingId;
        this.type = type;
        this.severity = severity;
        this.status = status;
        this.detectedAt = detectedAt;
        this.actualValue = actualValue;
        this.threshold = threshold;
        this.acknowledgedAt = acknowledgedAt;
    }

    public void acknowledge(Instant when) {
        if (status == AlarmStatus.ACKNOWLEDGED) return;
        status = AlarmStatus.ACKNOWLEDGED;
        acknowledgedAt = when;
    }

    public String getId() { return id; }
    public String getMeterId() { return meterId; }
    public String getSourceReadingId() { return sourceReadingId; }
    public AlarmType getType() { return type; }
    public AlarmSeverity getSeverity() { return severity; }
    public AlarmStatus getStatus() { return status; }
    public Instant getDetectedAt() { return detectedAt; }
    public BigDecimal getActualValue() { return actualValue; }
    public BigDecimal getThreshold() { return threshold; }
    public Instant getAcknowledgedAt() { return acknowledgedAt; }
}
