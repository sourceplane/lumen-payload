# Epic: lumen-payload-cms (PC)

**Lumen has no content plane: every page a product shows that is not an API
answer has to be shipped as code. This epic adds Payload CMS to Lumen as one
more deployable beside the fleet — a Next.js admin, a REST and GraphQL content
API, drafts, versions and localisation — on the data plane Lumen already
provisions, without changing any existing worker. The idea that makes it
possible: Payload ships as an OpenNext build on `cloudflare-worker-turbo`, the
one component type that renders deploy-time wiring, so it binds a Hyperdrive
config the same way `api-edge` does; and its schema lands through Lumen's own
`db-migrate` lane, in a `cms` Postgres schema, so the repository keeps one
migration authority.**

This baseline is for a team that wants Lumen's multi-tenant control plane and
also needs to publish content — a marketing site, docs, a blog, help articles,
or the course catalogue of the vertical built on top of it
(`multi-tenant-saas-2-lms`). When it ships, a product built from it goes live
with a working CMS admin at `/admin` on stage and prod, closed to strangers
until its owner opens it, and a content API the product's own surfaces can
read.

## Status

| Field | Value |
|-------|-------|
| Status | Shipped (PC0–PC3, PC5); PC4 gated on an `r2-data` secret |
| Cluster | **PC** (PC0–PC5) |
| Owner(s) | `apps/cms` (the CMS) · `infra/terraform/cloudflare-hyperdrive-cms` (its database path) · `packages/db` (its schema, as a migration) |
| Builds on | `lumen baseline-v32` — reuses Supabase, the `db-migrate` lane and the wiring model; touches no worker |
| Changes | Adds three components and one migration. Every existing component is unchanged. |
| Decisions locked | (1) Payload is a deployable **beside** the fleet, not a bounded context inside it. (2) It reads through its **own cache-disabled Hyperdrive config**. (3) Its schema is **SQL in the `db-migrate` lane**, in schema `cms`. (4) Payload is pinned to **3.89.0**. (5) The admin is **closed by default**; the owner opens it. |
| Gate | PC1 and PC2 are invisible (a database path and a schema). PC3 is the first visible change: `/admin` and `/health` answer on stage and prod. |
| Shipped as | sourceplane/lumen-payload#6 (spec), #7 (database path), #8 (schema), #9 (the CMS), #14 (the record) |

## Read order

1. `design.md` — the components, the schema, the routes, the owner steps, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| PC0 — the spec | this doc set | merged to `main` |
| PC1 — the CMS database path | `cloudflare-hyperdrive-cms`: a cache-disabled Hyperdrive config per environment and a generated Payload secret, both published as job-output secrets | the component applies on stage and prod and its wiring is published |
| PC2 — the CMS schema | migration `200_cms_payload_core`: schema `cms` and Payload's tables | `db-migrate` applies it on stage and prod |
| PC3 — the CMS on Workers | `apps/cms` (Payload 3.89 + Next 16.3 + OpenNext) with users, pages, posts and categories; `tests/cms` | `/health` answers `ok` and `/admin` answers 200 on stage and prod; an anonymous first-user registration is refused |
| PC4 — media on R2 | a media bucket per environment and an uploads collection on the R2 binding | an uploaded image is served back from stage — **gated on an `r2-data` secret** |
| PC5 — the record | operations guide, component docs, AGENTS.md, status | the owner steps are documented and the status file reads shipped |
