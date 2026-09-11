# MQTT smart-meter / device simulator

## Goal

This phase moves the laboratory from a REST-only application into a realistic IoT /
AMI telemetry flow.

The simulated smart meter no longer sends readings directly to the application REST
endpoint. It publishes device telemetry over MQTT. A transport adapter validates and
deduplicates MQTT messages, then forwards the domain reading contract to the existing
Spring Boot API.

```text
Smart-meter device simulator
          |
          | MQTT QoS 1
          v
Eclipse Mosquitto 2.1
          |
          v
MQTT ingestion adapter
  - topic validation
  - Zod payload validation
  - messageId deduplication
  - operational health/metrics
          |
          | REST
          v
Spring Boot application
          |
          +--> Reading persistence
          |
          +--> HIGH_VOLTAGE alarm rule
          |
          v
PostgreSQL / Flyway
          |
          v
Angular operations UI
```

## Topic contract

Telemetry:

```text
smart-metering/meters/{meterId}/telemetry
```

Device status:

```text
smart-metering/meters/{meterId}/status
```

The simulator publishes status as retained MQTT messages. It also configures an MQTT
Last Will message with `OFFLINE` status so unexpected disconnects are observable at the
broker level.

## Telemetry payload

Example:

```json
{
  "messageId": "fdd414e8-b36d-4659-a455-c07a29b06739",
  "meterId": "d2719db7-013b-4bb0-a56d-3793dc6be90f",
  "serialNumber": "SIM-0001",
  "firmwareVersion": "sim-1.0.0",
  "timestamp": "2026-09-11T12:00:00.000Z",
  "voltage": 230.2,
  "current": 4.2,
  "activePower": 918.5,
  "energyKwh": 12500.0021,
  "sequence": 1,
  "source": "smart-meter-device-simulator"
}
```

The transport adapter intentionally strips MQTT-specific metadata and forwards only the
existing backend reading contract:

- timestamp
- voltage
- current
- activePower
- energyKwh

This preserves the already-tested backend domain model.

## Simulator profiles

### normal

Produces realistic values below the lab alarm threshold.

### high-voltage

Produces voltage above 253 V so every reading exercises the existing
`HIGH_VOLTAGE` domain alarm.

### mixed

Produces mostly normal samples and a high-voltage sample every fourth reading. This is
the default end-to-end acceptance profile.

## Delivery and deduplication

Telemetry is published with MQTT QoS 1.

QoS 1 permits duplicate delivery. Every telemetry payload therefore includes a
`messageId`. The ingestion adapter maintains a short-lived in-memory deduplication
window and only forwards a successfully processed message once.

The adapter reserves the message while the REST request is in flight. If the backend
request fails, the reservation is released so a repeated publication can be attempted
again.

This is a portfolio-lab implementation, not durable exactly-once processing. A later
event-streaming phase can persist idempotency state and introduce Kafka.

## Runtime validation

The adapter exposes:

```text
GET http://127.0.0.1:18090/health
```

Example:

```json
{
  "status": "UP",
  "service": "mqtt-ingestion",
  "mqttConnected": true,
  "metrics": {
    "received": 4,
    "ingested": 4,
    "duplicates": 0,
    "rejected": 0,
    "failed": 0
  }
}
```

## Local operation

Start the complete stack:

```powershell
.\scripts\start-full-stack.ps1
```

Run a mixed device simulation:

```powershell
.\scripts\run-device-simulator.ps1 `
  -Profile mixed `
  -Count 8 `
  -IntervalMs 500
```

Run only high-voltage telemetry:

```powershell
.\scripts\run-device-simulator.ps1 `
  -Profile high-voltage `
  -Count 4 `
  -IntervalMs 500
```

Stop:

```powershell
.\scripts\stop-full-stack.ps1 -RemoveVolumes
```

## Verification

The full phase acceptance is:

```powershell
.\scripts\verify-mqtt-phase.ps1
```

It verifies:

- all existing backend, Angular, API and Playwright tests
- MQTT adapter unit tests
- device simulator unit tests
- Mosquitto health
- MQTT ingestion health and broker connectivity
- normal MQTT telemetry persistence
- high-voltage alarm generation
- duplicate message suppression
- malformed telemetry rejection
- MQTT-to-Angular browser visibility
- a real device-simulator Docker container run
- runtime stability of all long-running containers

## Security boundary

The local Mosquitto configuration deliberately uses anonymous access to keep the lab
self-contained. That is suitable only for local development and CI.

A production-like hardening phase would add:

- TLS
- per-device credentials or certificates
- topic ACLs
- secret management
- certificate rotation
- durable idempotency
- dead-letter / retry handling
- broker clustering and observability