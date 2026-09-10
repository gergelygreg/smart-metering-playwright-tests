CREATE TABLE meters (
    id VARCHAR(36) PRIMARY KEY,
    serial_number VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL,
    firmware_version VARCHAR(64) NOT NULL
);

CREATE TABLE meter_readings (
    id VARCHAR(36) PRIMARY KEY,
    meter_id VARCHAR(36) NOT NULL,
    reading_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    voltage NUMERIC(19,6) NOT NULL,
    current_amp NUMERIC(19,6) NOT NULL,
    active_power NUMERIC(19,6) NOT NULL,
    energy_kwh NUMERIC(19,6) NOT NULL,
    CONSTRAINT fk_reading_meter FOREIGN KEY (meter_id)
        REFERENCES meters(id) ON DELETE CASCADE
);
CREATE INDEX idx_reading_meter ON meter_readings(meter_id);

CREATE TABLE alarms (
    id VARCHAR(36) PRIMARY KEY,
    meter_id VARCHAR(36) NOT NULL,
    source_reading_id VARCHAR(36) NOT NULL,
    alarm_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_value NUMERIC(19,6) NOT NULL,
    threshold_value NUMERIC(19,6) NOT NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT fk_alarm_meter FOREIGN KEY (meter_id)
        REFERENCES meters(id) ON DELETE CASCADE,
    CONSTRAINT fk_alarm_reading FOREIGN KEY (source_reading_id)
        REFERENCES meter_readings(id) ON DELETE CASCADE
);
CREATE INDEX idx_alarm_meter ON alarms(meter_id);
CREATE INDEX idx_alarm_reading ON alarms(source_reading_id);
