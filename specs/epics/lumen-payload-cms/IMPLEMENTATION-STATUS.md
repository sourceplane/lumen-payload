# lumen-payload-cms (PC) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| PC0 — the spec | ✅ Shipped | sourceplane/lumen-payload#6 |
| PC1 — the CMS database path | ✅ Shipped: `lumen-payload-cms-stage` and `-prod` applied, wiring and `CMS_PAYLOAD_SECRET` published | sourceplane/lumen-payload#7 |
| PC2 — the CMS schema | ✅ Shipped: `200_cms_payload_core` applied on stage and prod | sourceplane/lumen-payload#8 |
| PC3 — the CMS on Workers | ✅ Shipped: `lumen-payload-cms-stage` and `-prod` live | sourceplane/lumen-payload#9 |
| PC4 — media on R2 | ✅ Shipped: buckets `stg-lumen-payload-cms-media-stage` and `prod-lumen-payload-cms-media-prod` applied, `media` live on stage and prod | sourceplane/lumen-payload#15 (bucket), #16 (media), #18 (deploy fix), #17 (record) |
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

Media (PC4), after #18's main run (40666021733) deployed both environments:

- The deploy log of each environment lists `env.R2_MEDIA` bound to that
  environment's bucket (`stg-lumen-payload-cms-media-stage`,
  `prod-lumen-payload-cms-media-prod`), deployed with the brokered
  `workers-deploy` token and `--x-provision=false`.
- `GET /api/media` answers an empty, anonymous-readable list.
- An anonymous upload (`POST /api/media`) answers 403.
- The CMS suite (65 tests, including the media suite) passed in each lane.

**Not yet verified live: a staff upload served back from R2.** It needs a
staff account, and none exists on either environment: the admin is closed until
the owner sets `CMS_SETUP_TOKEN` and opens `/setup`. The same path ran
end to end on the built Worker in workerd with a local R2 bucket (upload, the
file served back byte for byte and present in the bucket, SVG, missing alt text
and over-limit uploads refused, editor delete refused, admin delete removing
it from the bucket). The first owner upload on stage is the live check
(`apps/cms/docs/runbook.md`, Media).

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
  turbo-package lanes ignored their command parameters (0.20.1 fixed that;
  this repository pins 0.21.0 since #18).
- **Landing order.** PC1, PC2 and PC3 were developed as a stack and landed one
  at a time after the baseline's bootstrap finished. PC2's own run was
  plan-only (lanes run only for pull requests into `main`, and it was pushed
  while its base was still PC1's branch), so its `db`, `db-tests` and
  `db-migrate` lanes ran in PC3's pull request, which carried the same commit.
- **Workers Paid (PC-H) was needed before anything here could land:** the
  baseline's own 04-workers phase stopped on Free's cron limit, and the owner
  upgraded the account.

- **PC4 landed as two tasks and three pull requests.** PC-5 is the bucket
  (`cloudflare-r2-cms`, #15) and PC-7 is the CMS side (#16), so the bucket
  could apply and publish its wiring on both environments before the CMS
  rendered `R2_MEDIA` (PC-J). #18 then moved the stack pin to 0.21.0 so the CMS
  could deploy at all (PC-K).
- **Resource names carry the environment's namespace prefix.** The plan says
  `lumen-payload-cms-media-<env>`; Terraform builds every name from the
  environment's `namespacePrefix`, so the buckets are
  `stg-lumen-payload-cms-media-stage` and `prod-lumen-payload-cms-media-prod`.
  The same holds for the Hyperdrive configs (`stg-lumen-payload-cms-stage`,
  `prod-lumen-payload-cms-prod`).
- **The R2 token is a rotated project secret.** `CLOUDFLARE_R2_TOKEN` sits on
  the project's rung, minted from the `r2-data` template in rotated mode (the
  platform rotates it every 30 days). It is not a value anyone pasted, and only
  `cloudflare-r2-cms` reads it.
- **Uploads over the limit are refused, not truncated.** Payload's default
  `upload.limits.fileSize` stops reading at the limit and stores what it has:
  in the local run an 11 MiB PNG came back 201, stored cut off at the limit. The root config sets
  `abortOnLimit: true`, so an upload over 10 MiB answers 413 and nothing is
  stored.
- **No SVG, and no resizing.** The plan said "images". SVG is refused because
  it can carry script on the admin's origin. workerd has no `sharp`, so there
  is no cropping, focal point or image sizes: a file is stored and served as
  uploaded.

## Found while landing

- **PC-J:** the first landing of a wiring source and its consumer in one push
  races across environments. Avoided here by landing PC1 on its own; seen and
  recovered on multi-tenant-saas-2.
- **PC-K:** wrangler's default resource provisioning reads every R2 bucket
  binding with the deploy token, which has no R2 permission. Fixed by
  stack-tectonic 0.21.0's `skipResourceProvisioning` (sourceplane/stack-tectonic#22).
- **R2 is off on a new Cloudflare account** until the owner enables it in the
  dashboard (10042). This account's owner did so on 2026-10-28.
