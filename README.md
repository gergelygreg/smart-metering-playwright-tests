# smart-metering-playwright-tests
IoT and Smart Metering test automation lab using Angular, Java Spring Boot and Playwright TypeScript.

## Persistence

The REST/API MVP is backed by Spring Data JPA, PostgreSQL and Flyway.
The persistence layer keeps the existing Meter, Reading and Alarm API
contracts while replacing in-memory state with relational persistence.

See [`docs/persistence.md`](docs/persistence.md) for the schema, local
runtime and verification approach.
