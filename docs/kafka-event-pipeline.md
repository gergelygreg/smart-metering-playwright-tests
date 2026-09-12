# Kafka event-driven smart-metering pipeline

## Architecture

```text
Smart-meter device
      |
      | MQTT QoS 1
      v
Eclipse Mosquitto
      |
      v
MQTT ingestion adapter
      |
      | smart-metering.telemetry.received.v1
      v
Apache Kafka 4.3.1 (KRaft)
      |
      v
Kafka event service
      |
      +---- REST ----> Spring Boot ----> PostgreSQL
      |                   |
      |                   +--> Reading
      |                   +--> HIGH_VOLTAGE Alarm
      |
      +--> smart-metering.reading.persisted.v1
      +--> smart-metering.alarm.created.v1
                        |
                        v
              audit consumer group
                        |
                 /health /events
```

The MQTT adapter is now a transport edge. It validates device telemetry and publishes a
versioned Kafka event instead of writing directly to the backend.

The Kafka event service contains two explicit consumer-group responsibilities:

- `smart-metering-telemetry-processor-v1` consumes telemetry and invokes the existing REST/domain layer.
- `smart-metering-event-audit-v1` independently consumes downstream reading/alarm events and builds an in-memory audit projection for verification.

The service can be split into separate Deployments in the later Kubernetes phase without changing the event contracts.

## Topics

- `smart-metering.telemetry.received.v1`
- `smart-metering.reading.persisted.v1`
- `smart-metering.alarm.created.v1`

Each topic has three partitions and replication factor 1 in the local single-broker lab.
Messages are keyed by `meterId`, preserving per-meter partition ordering.

## Event envelope

Events contain:

- `eventId`
- `eventType`
- `eventVersion`
- `occurredAt`
- `correlationId`
- `causationId` for downstream domain events
- `meterId`
- versioned payload

The correlation id follows one device operation across MQTT, Kafka, persistence and alarm publication.

## Semantics

The lab explicitly demonstrates **at-least-once** delivery.

The MQTT adapter deduplicates QoS-1 device `messageId` values in-memory. The Kafka processor also maintains a bounded in-memory `eventId` deduplication window.

This is not advertised as end-to-end exactly-once processing. A crash between backend persistence and downstream Kafka publication can create replay ambiguity. A later production-hardening step could introduce a transactional outbox and durable idempotency.

## Local endpoints

```text
Kafka broker:         127.0.0.1:29092
Kafka event service:  http://127.0.0.1:18100/health
Event projection:     http://127.0.0.1:18100/events
```

## Verification

```powershell
.\scripts\verify-kafka-phase.ps1
```

The full acceptance covers component unit tests, REST/API regression, MQTT-through-Kafka integration, direct Kafka contracts, per-meter ordering, duplicate suppression, invalid events, downstream Reading/Alarm events, browser E2E and a real simulator container.

Automated test total after this phase: **159**.
