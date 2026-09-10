# Persistence phase

The REST/API contract is backed by Spring Data JPA and PostgreSQL.

## Runtime stack

- Spring Data JPA / Hibernate
- PostgreSQL
- Flyway versioned migrations
- H2 in PostgreSQL compatibility mode for fast Maven regression tests

## Data model

- `meters` is the aggregate root.
- `meter_readings` references `meters`.
- `alarms` references both the owning meter and its source reading.
- Database foreign keys use `ON DELETE CASCADE` as a final integrity guarantee.
- Application lifecycle services still expose explicit cleanup behavior.

## Configuration

The default backend runtime expects PostgreSQL on port `15432`.

Environment overrides:

- `DB_URL`
- `DB_USER`
- `DB_PASSWORD`

Hibernate runs with `ddl-auto=validate`; Flyway owns schema evolution.

## Local PostgreSQL

```powershell
docker compose -f docker-compose.persistence.yml up -d
```

## Acceptance criteria

The phase is complete when:

1. Maven backend regression is green against H2 PostgreSQL compatibility mode.
2. Flyway applies the schema successfully.
3. The existing Playwright API suite is green against real PostgreSQL.
4. Meter, Reading, generated Alarm and acknowledgement survive a backend process restart.
5. Meter lifecycle deletion still removes its child data cleanly.
