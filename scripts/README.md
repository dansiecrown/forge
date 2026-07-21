# Scripts

This directory holds reviewed, idempotent developer/CI tasks only: contract generation/verification, migration checks, seed/reset helpers for non-production, and repository validation, as defined in `docs/project-structure.md`.

Scripts must not embed credentials, silently mutate production, or replace the owning application's business code. No scripts exist yet; they are added alongside the capabilities they support (API contract generation in a later phase, migration tooling in the data-platform phase, etc.).
