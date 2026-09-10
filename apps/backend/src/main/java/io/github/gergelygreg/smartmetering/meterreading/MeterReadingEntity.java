package io.github.gergelygreg.smartmetering.meterreading;

import java.math.BigDecimal;
import java.time.Instant;
import jakarta.persistence.*;

@Entity
@Table(name = "meter_readings")
public class MeterReadingEntity {
    @Id
    @Column(nullable = false, length = 36)
    private String id;

    @Column(name = "meter_id", nullable = false, length = 36)
    private String meterId;

    @Column(name = "reading_timestamp", nullable = false)
    private Instant timestamp;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal voltage;

    @Column(name = "current_amp", nullable = false, precision = 19, scale = 6)
    private BigDecimal current;

    @Column(name = "active_power", nullable = false, precision = 19, scale = 6)
    private BigDecimal activePower;

    @Column(name = "energy_kwh", nullable = false, precision = 19, scale = 6)
    private BigDecimal energyKwh;

    protected MeterReadingEntity() {}

    public MeterReadingEntity(String id, String meterId, Instant timestamp, BigDecimal voltage,
                              BigDecimal current, BigDecimal activePower, BigDecimal energyKwh) {
        this.id = id;
        this.meterId = meterId;
        this.timestamp = timestamp;
        this.voltage = voltage;
        this.current = current;
        this.activePower = activePower;
        this.energyKwh = energyKwh;
    }

    public String getId() { return id; }
    public String getMeterId() { return meterId; }
    public Instant getTimestamp() { return timestamp; }
    public BigDecimal getVoltage() { return voltage; }
    public BigDecimal getCurrent() { return current; }
    public BigDecimal getActivePower() { return activePower; }
    public BigDecimal getEnergyKwh() { return energyKwh; }
}
