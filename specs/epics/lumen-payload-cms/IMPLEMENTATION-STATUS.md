# lumen-payload-cms (PC) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| PC0 — the spec | ✅ Shipped | sourceplane/lumen-payload#6 |
| PC1 — the CMS database path | ✅ Shipped: `lumen-payload-cms-stage` and `-prod` applied, wiring and `CMS_PAYLOAD_SECRET` published | sourceplane/lumen-payload#7 |
| PC2 — the CMS schema | ✅ Shipped: `200_cms_payload_core` applied on stage and prod | sourceplane/lumen-payload#8 |
| PC3 — the CMS on Workers | ✅ Shipped: `lumen-payload-cms-stage` and `-prod` live | sourceplane/lumen-payload#9 |
| PC4 — media on R2 | ⏸ Gated: needs `CLOUDFLARE_R2_TOKEN` from the Cloudflare connection's `r2-data` template (PC-F) | — |
| PC5 — the record | ✅ Shipped | sourceplane/lumen-payload#14 |

## Live verification (2026-10-28)

On both `https://lumen-payload-cms-stage.nexo-7be.workers.dev` and
`https://lumen-payload-cms-prod.nexo-7be.workers.dev`:

- `/health` answers `{"status":"ok","db":"ok"}`: Payload initialised, and a
  query reached schema `cms` through `HYPERDRIVE_CMS`.
- `/admin` answers 200.
- An anonymous `POST /api/users/first-register` answers 403 with the
  setup-closed message: no setup token is set, so no first account can be
  made.
- `GET /api/pages` and the GraphQL `Pages` query answer with an empty,
  anonymous-readable list.

The CMS lane's smoke check asserted the first two after each deploy.

## Departures from the design

- **The wiring and the Payload secret are optional references.** The CMS
  declares `WIRING_CLOUDFLARE_HYPERDRIVE_CMS_{STAGE,PROD}` and
  `PAYLOAD_SECRET` in the top-level `optionalSecretEnv`, not in per-environment
  `secretEnv`. A required reference fails secret resolution for every pull
  request until the Hyperdrive component's first apply, and the resolver
  silently drops optional references declared per environment. A deploy still
  cannot run without the wiring: `wire-live` refuses an empty document.
- **The first-user gate is on the operation, not the page.** §4 says
  `/admin/create-first-user` passes only with the setup cookie. As built, the
  page renders for anyone, and a `beforeOperation` hook on `users` refuses
  *creating* the first account, by any route (the form's submit,
  `first-register`, REST or GraphQL), until setup is opened. The account
  cannot be taken; a visitor only sees a form that will refuse them.
- **The CMS suite runs inside the CMS lane's build** (PC-I): the `cms`
  component's `buildCommand` runs `tests/cms` after the OpenNext build, and the
  suite's own `build` script runs it too, because stack-tectonic 0.20.0's
  turbo-package lanes ignore their command parameters.
- **Landing order.** PC1, PC2 and PC3 were developed as a stack and landed one
  at a time after the baseline's bootstrap finished. PC2's own run was
  plan-only (lanes run only for pull requests into `main`, and it was pushed
  while its base was still PC1's branch), so its `db`, `db-tests` and
  `db-migrate` lanes ran in PC3's pull request, which carried the same commit.
- **Workers Paid (PC-H) was needed before anything here could land:** the
  baseline's own 04-workers phase stopped on Free's cron limit, and the owner
  upgraded the account.

## Found while landing

- **PC-J:** the first landing of a wiring source and its consumer in one push
  races across environments. Avoided here by landing PC1 on its own; seen and
  recovered on multi-tenant-saas-2.
