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
## Full Docker stack and CI/CD

The application can run as a production-like three-container stack:

- Angular production build served by Nginx
- Nginx `/api` reverse proxy to Spring Boot
- Spring Boot Java 21 backend
- PostgreSQL 17 with Flyway migrations

Start it locally with:

```powershell
.\scripts\start-full-stack.ps1
```

Run the full local Docker acceptance with:

```powershell
.\scripts\verify-docker-ci-phase.ps1
```

GitHub Actions runs backend, frontend, API, browser and Docker integration quality gates.
Validated `main` and version-tag builds are continuously delivered to GitHub Container
Registry as separate backend and frontend images. See `docs/docker-ci-cd.md`.