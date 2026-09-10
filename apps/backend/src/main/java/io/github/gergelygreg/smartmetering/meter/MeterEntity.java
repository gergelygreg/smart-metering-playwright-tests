package io.github.gergelygreg.smartmetering.meter;

import jakarta.persistence.*;

@Entity
@Table(name = "meters")
public class MeterEntity {
    @Id
    @Column(nullable = false, length = 36)
    private String id;

    @Column(name = "serial_number", nullable = false, unique = true, length = 128)
    private String serialNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private MeterStatus status;

    @Column(name = "firmware_version", nullable = false, length = 64)
    private String firmwareVersion;

    protected MeterEntity() {}

    public MeterEntity(String id, String serialNumber, MeterStatus status, String firmwareVersion) {
        this.id = id;
        this.serialNumber = serialNumber;
        this.status = status;
        this.firmwareVersion = firmwareVersion;
    }

    public String getId() { return id; }
    public String getSerialNumber() { return serialNumber; }
    public MeterStatus getStatus() { return status; }
    public String getFirmwareVersion() { return firmwareVersion; }
}
