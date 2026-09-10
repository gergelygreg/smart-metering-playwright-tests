# Angular frontend and Playwright UI automation

## Purpose

This phase adds a user-facing operations console to the fictional smart-metering lab.
The UI is deliberately focused on application-level AMI workflows rather than physical
meter hardware validation.

## Frontend architecture

- Angular 22 standalone application under `apps/frontend`
- Angular Router with lazy-loaded fleet and meter-detail pages
- Reactive Forms for meter provisioning and telemetry ingestion
- Typed `HttpClient` service aligned to the existing Spring Boot REST contracts
- Development proxy from `/api` to `http://127.0.0.1:18080`
- No backend CORS change is required for local development

## Supported workflows

1. Check backend health.
2. List smart meters.
3. Provision a meter with serial number, status and firmware version.
4. Open a meter operational view.
5. Store voltage/current/power/energy readings.
6. Observe automatic `HIGH_VOLTAGE` alarms when voltage exceeds the lab threshold.
7. Acknowledge an active alarm.
8. Reload the UI and verify acknowledged state from persistent storage.
9. Delete a meter aggregate together with readings and alarms.

## Test strategy

Frontend unit tests cover the typed HTTP contract and application shell.

Playwright UI tests use stable `data-testid` selectors and Page Object Models:

- `src/ui/pages/MeterListPage.ts`
- `src/ui/pages/MeterDetailPage.ts`

The UI suite intentionally runs with one worker because all scenarios share one local
PostgreSQL-backed application environment. Test records use unique serial numbers and
are explicitly cleaned up.

## Commands

```powershell
npm run frontend:build
npm run frontend:test
npm run test:ui
npm run test:ui:headed
```

For the complete cross-layer acceptance run:

```powershell
.\scripts\verify-ui-phase.ps1
```

The verification script keeps WSL alive, starts PostgreSQL, starts the packaged Spring
Boot backend, starts Angular with its API proxy, and then executes both API and UI
Playwright suites.