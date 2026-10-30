# Component review — what each one declares, and how fully it is documented

Every one of this repository's **49 components** — the Lumen baseline's 45
and the four the CMS adds — scored on five measurable signals. Generated
against the tree on 2026-10-30, not typed by hand, so a number here is a fact
about the repository rather than an impression of it.

## The rubric

One point each, out of five:

| | signal | why it is the bar |
|---|---|---|
| 1 | `docs/overview.md` exists | the catalog's primary page for the component |
| 2 | `metadata.description` is set | without it the catalog row has no summary; orun emits the `Repo` entity from `description` alone |
| 3 | the overview carries 3+ headings | a title and one paragraph is a stub, however well written |
| 4 | the overview runs to 100+ words | enough to say what it is, what it needs and what breaks |
| 5 | 2+ further `docs.pages` are declared (architecture, runbook) | somewhere to put what the overview should not carry |

A 5 is not a ceiling on quality and a 3 is not a failing component — a small
pure package may deserve a short page. The scores are here to show **where the
documentation is thinnest**, not to rank the code.

## Scores

| component | domain | type | score | overview words | headings | description |
|---|---|---|---|---|---|---|
| `cloudflare-hyperdrive-cms` | infra | terraform | **5/5** | 169 | 4 | yes |
| `cloudflare-r2-cms` | infra | terraform | **5/5** | 179 | 4 | yes |
| `api-edge` | starter-runtime | cloudflare-worker-turbo | **5/5** | 222 | 3 | yes |
| `billing-worker` | starter-runtime | cloudflare-worker-turbo | **5/5** | 104 | 3 | yes |
| `cms` | starter-runtime | cloudflare-worker-turbo | **5/5** | 392 | 4 | yes |
| `integrations-worker` | starter-runtime | cloudflare-worker-turbo | **5/5** | 104 | 3 | yes |
| `membership-worker` | starter-runtime | cloudflare-worker-turbo | **5/5** | 159 | 3 | yes |
| `policy-worker` | starter-runtime | cloudflare-worker-turbo | **5/5** | 151 | 3 | yes |
| `projects-worker` | starter-runtime | cloudflare-worker-turbo | **5/5** | 104 | 3 | yes |
| `cms-tests` | starter-tests | turbo-package | **5/5** | 550 | 3 | yes |
| `web-console-next` | starter-ui | cloudflare-workers-assets-turbo | **5/5** | 202 | 4 | yes |
| `cloudflare-domain` | infra | terraform | **4/5** | 64 | 3 | yes |
| `cloudflare-hyperdrive` | infra | terraform | **4/5** | 83 | 3 | yes |
| `cloudflare-kv` | infra | terraform | **4/5** | 52 | 3 | yes |
| `supabase` | infra | terraform | **4/5** | 70 | 3 | yes |
| `contracts` | starter-contracts | turbo-package | **4/5** | 257 | 2 | yes |
| `db` | starter-data | turbo-package | **4/5** | 205 | 2 | yes |
| `admin-worker` | starter-runtime | cloudflare-worker-turbo | **4/5** | 57 | 3 | yes |
| `config-worker` | starter-runtime | cloudflare-worker-turbo | **4/5** | 70 | 3 | yes |
| `events-worker` | starter-runtime | cloudflare-worker-turbo | **4/5** | 78 | 3 | yes |
| `identity-worker` | starter-runtime | cloudflare-worker-turbo | **4/5** | 90 | 3 | yes |
| `metering-worker` | starter-runtime | cloudflare-worker-turbo | **4/5** | 72 | 3 | yes |
| `notifications-worker` | starter-runtime | cloudflare-worker-turbo | **4/5** | 81 | 3 | yes |
| `webhooks-worker` | starter-runtime | cloudflare-worker-turbo | **4/5** | 71 | 3 | yes |
| `admin-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `api-edge-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `billing-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `config-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `contracts-tests` | starter-tests | turbo-package | **4/5** | 118 | 2 | yes |
| `db-tests` | starter-tests | turbo-package | **4/5** | 118 | 2 | yes |
| `identity-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `integrations-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `membership-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `metering-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `notifications-client-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `notifications-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `platform-limits-tests` | starter-tests | turbo-package | **4/5** | 334 | 2 | yes |
| `policy-engine-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `policy-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `projects-worker-tests` | starter-tests | turbo-package | **4/5** | 121 | 2 | yes |
| `db-migrate` | infra | db-migrate | **3/5** | 53 | 2 | yes |
| `cli` | starter-cli | turbo-package | **3/5** | 32 | 2 | yes |
| `sdk` | starter-sdk | turbo-package | **3/5** | 43 | 2 | yes |
| `notifications-client` | starter-shared | turbo-package | **3/5** | 58 | 2 | yes |
| `policy-engine` | starter-shared | turbo-package | **3/5** | 54 | 2 | yes |
| `shared` | starter-shared | turbo-package | **3/5** | 37 | 2 | yes |
| `testing` | starter-shared | turbo-package | **3/5** | 41 | 2 | yes |
| `webhook-verifier` | starter-shared | turbo-package | **3/5** | 55 | 2 | yes |
| `web-console-next-tests` | starter-tests | turbo-package | **3/5** | 96 | 1 | yes |

Distribution: **5/5**: 11 · **4/5**: 29 · **3/5**: 9.

## What the CMS added

- **The four CMS components score 5/5**: `cms`, `cms-tests`,
  `cloudflare-hyperdrive-cms` and `cloudflare-r2-cms` each carry an overview
  with its headings and a runbook, and the CMS's runbook is where the owner's
  first-admin step lives.
- **`web-console-next` rose to 5/5** when it became the redirect Worker: its
  pages describe the 308 into the CMS and nothing else.
- **`web-console-next-tests` fell to 3/5**: its suite is now the redirect's
  table, and its overview shrank with it (96 words, one heading). It is the
  thinnest page in the repository.

## The finding that is not a documentation problem

**26 components subscribe with `profile: quick-check`, and that profile runs no
tests.** The Lumen baseline observed it directly on its own CI (a `db-tests ·
dev · Verify` lane that ran setup, install and a 0.0s package-structure check,
and no tests), and it is true here, component for component: the suites live
in `preBuildCommand`, which `quick-check` skips, and the lane is still named
`· Verify`.

**This repository has its own evidence now.** `tests/platform-limits` pins the
deepest service-binding chain, and the CMS's sign-in binding to api-edge
(lumen-payload-console PX1) made `cms` one hop deeper than the edge — a
deliberate change the suite asks to be recorded. It went unrecorded for three
pull requests, because `platform-limits-tests` is on `quick-check` and its
suite never ran. `testing/branded-fork.test.sh`, which runs every suite of a
placed product, found it; the depth is recorded now (`cms`, 9, under the
fleet's budget of 12).

The fix is one word per component — `profile: verify` — and it is **not in
this change on purpose**, for the reason the Lumen baseline gave: it turns on
suites that have never run in a product's CI, and the right change for that is
one that can watch what it turns on. The baseline's own CI runs every suite of
a placed product instead (`branded-fork`), so a product is not born with a red
one.

Components on `quick-check`: `admin-worker-tests`, `api-edge-tests`, `billing-worker-tests`, `cli`, `config-worker-tests`, `contracts`, `contracts-tests`, `db`, `db-tests`, `identity-worker-tests`, `integrations-worker-tests`, `membership-worker-tests`, `metering-worker-tests`, `notifications-client`, `notifications-client-tests`, `notifications-worker-tests`, `platform-limits-tests`, `policy-engine`, `policy-engine-tests`, `policy-worker-tests`, `projects-worker-tests`, `sdk`, `shared`, `testing`, `web-console-next-tests`, `webhook-verifier`.

## Declared product URLs

This repository's own environment doors, probed 2026-10-30 (read-only GETs):

| URL | answer |
|---|---|
| `lumen-payload-api-edge-stage…workers.dev/health` | 200 |
| `lumen-payload-api-edge-prod…workers.dev/health` | 200 |
| `lumen-payload-cms-stage…workers.dev/health` | 200 |
| `lumen-payload-cms-prod…workers.dev/health` | 200 |
| `lumen-payload-web-console-next-stage…workers.dev` | 308 → the CMS |
| `lumen-payload-web-console-next-prod…workers.dev` | 308 → the CMS |

These are `environments.<env>.url` and `links` in `intent.yaml`, which
`rebrand.mjs` rewrites per product; a product's own answer after `06-console`
is what its build's probes check.

## Catalog ref collisions (orun v2.89.0)

v2.89.0 refuses a domain, system or environment whose name gives it a
component's catalog ref — the component would be hidden in Orunbase. This
repository is clean: its domains are `infra, starter-cli, starter-contracts,
starter-data, starter-runtime, starter-sdk, starter-shared, starter-tests,
starter-ui`, and no component shares a name with any of them.
