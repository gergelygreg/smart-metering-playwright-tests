# Kubernetes orchestration

## Goal

This phase moves the containerized smart-metering platform from Docker Compose into a
real Kubernetes control plane while preserving the verified REST, MQTT, Kafka,
PostgreSQL and browser behavior.

The local and CI cluster uses:

- kind `v0.33.0`
- Kubernetes `v1.37.0`
- a digest-pinned kind node image
- Deployments, StatefulSets, Services, ConfigMaps, runtime Secrets, Jobs,
  startup/readiness/liveness probes and PersistentVolumeClaims
- Kustomize through `kubectl -k`

## Topology

```text
kind / Kubernetes 1.37
│
├── PostgreSQL StatefulSet + PVC
├── Kafka StatefulSet + PVC
├── Mosquitto Deployment
│
├── Spring Boot backend Deployment (2 replicas)
├── MQTT ingestion Deployment
├── Kafka event service Deployment
├── Angular/Nginx frontend Deployment (2 replicas)
│
└── Smart-meter simulator Job
```

Internal service discovery uses Kubernetes DNS:

```text
postgres:5432
mqtt-broker:1883
kafka:9092
backend:8080
kafka-event-service:8100
```

## Workload choice

PostgreSQL and Kafka use StatefulSets because identity and data volumes matter.

The backend, frontend and event/transport adapters use Deployments.

The smart-meter simulator is a Job because it represents a finite test workload rather
than a permanently running production service.

## Configuration

Non-sensitive runtime values live in the `smart-metering-config` ConfigMap.

Database credentials are not committed to Git. The deployment script creates the
`smart-metering-db` Secret at deployment time. Local lab defaults can be overridden by
environment variables.

## Health model

Existing application health contracts are mapped to Kubernetes startup, readiness and
liveness probes:

```text
backend             /api/health
frontend            /healthz
mqtt-ingestion      /health
kafka-event-service /health
postgres            pg_isready
kafka               kafka-topics --list
mosquitto            TCP/1883
```

## Persistence

The lab creates:

```text
PostgreSQL PVC   1 GiB
Kafka PVC        2 GiB
```

Acceptance requires all PVCs to reach `Bound`.

This is a single-node local lab, not a production HA storage design.

## Local verification

```powershell
.\scripts\verify-kubernetes-phase.ps1
```

Keep the cluster after verification:

```powershell
.\scripts\verify-kubernetes-phase.ps1 -KeepCluster
```

Interactive startup:

```powershell
.\scripts\start-kubernetes-kind.ps1
```

Interactive shutdown:

```powershell
.\scripts\stop-kubernetes-kind.ps1
```

The Windows wrapper intentionally keeps Node/Playwright tests on the existing Windows
toolchain while Kubernetes and Docker run in WSL Ubuntu.

## Operational acceptance

Beyond the existing application suites, this phase verifies:

- pod rollout
- startup/readiness/liveness probes
- Service discovery
- ConfigMap and Secret injection
- StatefulSet storage
- PVC binding
- simulator Job execution
- backend pod deletion and automatic replacement
- backend scaling from 2 replicas to 3 and back to 2

## CI/CD

GitHub Actions creates a temporary kind cluster after the Docker full-stack gate. It
builds the local application images, loads them into kind, deploys the platform, and
reruns the 53 REST/MQTT/Kafka/UI integration tests against Kubernetes.

GHCR publication is gated on the Kubernetes acceptance succeeding.

## Edge networking note

This phase uses deterministic `kubectl port-forward` for local and CI access.

It intentionally does not introduce ingress-nginx. That controller was retired by the
Kubernetes project in March 2026. A later edge-networking slice should use Gateway API
with an actively maintained implementation such as Envoy Gateway.

## Production boundary

This phase demonstrates orchestration, not production HA. Production would still need
decisions around replicated/managed data services, TLS, MQTT authentication, external
secret management, NetworkPolicy, Gateway API, autoscaling policy, observability,
alerting and durable event idempotency/outbox design.
