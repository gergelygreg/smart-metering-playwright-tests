# smart-metering-playwright-tests
IoT and Smart Metering test automation lab using Angular, Java Spring Boot and Playwright TypeScript.

## Persistence

The REST/API MVP is backed by Spring Data JPA, PostgreSQL and Flyway.
The persistence layer keeps the existing Meter, Reading and Alarm API
contracts while replacing in-memory state with relational persistence.

See [`docs/persistence.md`](docs/persistence.md) for the schema, local
runtime and verification approach.

## Angular frontend and UI automation

The lab includes an Angular 22 operations console under `apps/frontend`. It supports
meter provisioning, telemetry ingestion, automatic high-voltage alarm inspection,
alarm acknowledgement, persisted-state reloads and aggregate deletion.

The browser layer is automated with Playwright TypeScript Page Object Models and a
dedicated Chromium UI suite. See `docs/frontend-ui.md` for architecture, workflows and
verification commands.