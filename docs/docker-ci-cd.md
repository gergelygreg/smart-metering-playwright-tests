# Full Docker stack and GitHub Actions CI/CD

## Architecture

The production-like local stack contains three containers:

```text
Browser
  |
  v
Angular static application / Nginx :8088
  |
  | /api/*
  v
Spring Boot API :18080 -> container :8080
  |
  v
PostgreSQL 17 :15432 -> container :5432
```

Nginx serves the Angular SPA and acts as the same-origin reverse proxy for `/api/*`.
The backend connects to PostgreSQL through the private Compose network. Flyway owns
schema migration and Hibernate validates the migrated schema.

## Images

### Backend

`apps/backend/Dockerfile` is a multi-stage Java 21 build:

- Maven + Eclipse Temurin 21 build stage
- Spring Boot executable JAR
- Eclipse Temurin 21 JRE Alpine runtime
- non-root application user
- container health probe through `/api/health`

### Frontend

`apps/frontend/Dockerfile` is a multi-stage Angular build:

- Node.js 22.23.2
- npm 11.6.0 for deterministic dependency installation
- Angular production build
- Nginx stable Alpine runtime
- SPA fallback
- `/api/` reverse proxy to the backend service
- `/healthz` container health endpoint

## Local stack

Start the complete stack:

```powershell
.\scripts\start-full-stack.ps1
```

Endpoints:

- Angular/Nginx: `http://127.0.0.1:8088`
- Spring Boot API: `http://127.0.0.1:18080`
- PostgreSQL: `127.0.0.1:15432`

Stop while preserving PostgreSQL data:

```powershell
.\scripts\stop-full-stack.ps1
```

Stop and remove the database volume:

```powershell
.\scripts\stop-full-stack.ps1 -RemoveVolumes
```

The WSL Docker runtime in this lab can stop when no Linux process keeps the distribution
alive. The PowerShell start and verification scripts therefore launch a direct
`wsl.exe -d Ubuntu-24.04 -- sleep infinity` keepalive and clean it up explicitly.

## Local full verification

```powershell
.\scripts\verify-docker-ci-phase.ps1
```

The verification covers:

1. 59 backend Maven/JPA/Flyway tests
2. root TypeScript typecheck
3. 6 Playwright TypeScript unit tests
4. 5 Angular/Vitest unit tests
5. Angular production build
6. Docker Compose model validation
7. backend and frontend production image builds
8. PostgreSQL/backend/frontend health
9. direct backend health
10. Nginx-to-backend `/api` reverse proxy
11. Angular SPA fallback
12. 35 Playwright API tests against the containerized backend
13. 8 Playwright Chromium E2E tests against the containerized frontend
14. post-suite container health

Current automated test total: **113**.

## GitHub Actions quality gate

`.github/workflows/ci-cd.yml` runs on:

- pull requests
- pushes to `main`
- `v*` tags
- manual workflow dispatch

The pipeline has four stages:

### Backend

Java 21, Maven wrapper, JPA/Flyway/H2 persistence regression.

### Frontend and test framework

Node.js 22.23.2, npm 11.6.0, root TypeScript validation, Playwright unit tests,
Angular unit tests and Angular production build.

### Docker full-stack integration

GitHub-hosted Linux runner builds the actual production Dockerfiles, launches the
three-container stack, installs Chromium, then runs the 35 API and 8 browser E2E tests
against those containers. Docker logs and Playwright reports are retained as workflow
artifacts.

### Continuous delivery to GHCR

Only after every preceding quality gate succeeds, pushes to `main` and `v*` tags publish:

- `ghcr.io/<owner>/smart-metering-api`
- `ghcr.io/<owner>/smart-metering-ui`

Published images receive branch/tag/SHA metadata. The default branch also receives
`latest`. BuildKit provenance and SBOM metadata are enabled.

The workflow uses the repository-scoped `GITHUB_TOKEN`; no registry password is stored
in the repository. The publish job only requests `packages: write`.

## Release flow

A normal push to `main` publishes a validated `latest` image plus SHA tag.

A versioned release can be created with:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

The same complete quality gate runs first. If it stays green, GHCR receives semantic
version tags generated from the Git tag.

## Dependency automation

`.github/dependabot.yml` checks:

- GitHub Actions
- root npm dependencies
- Angular npm dependencies
- Maven dependencies
- backend Docker base image
- frontend Docker base images

on a weekly cadence.