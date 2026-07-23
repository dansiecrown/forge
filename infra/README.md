# Infrastructure

This directory holds infrastructure-as-code, deployment manifests, and environment templates, as defined in `docs/project-structure.md`. It must not contain application business logic.

No cloud vendor has been selected yet (see `docs/development-roadmap.md`, Section 2: "Production cloud, managed PostgreSQL/Redis/object-storage, email, error-monitoring, and observability vendors"). Content is added here once that decision is made.

Local-only development services (PostgreSQL, Redis) run via `docker-compose.dev.yml` at the repository root, not here — that file is developer tooling, not deployable infrastructure, per the root/infra split in `docs/project-structure.md` §3.
