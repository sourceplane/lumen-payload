# lumen-payload-cms — design

## 0. Where Payload sits, and why there

Lumen is thirteen bounded-context Workers behind one `api-edge`, plus a
Next.js console. Payload is one Next.js application: `@payloadcms/next` hosts
the admin panel **and** the REST/GraphQL layer, over a core `payload` package
that alone touches the database. It cannot be split into a `content-worker`
and a console surface, so it joins the fleet as **one more deployable beside
it**, sharing the database and nothing else:

```
                 ┌───────────── existing, unchanged ─────────────┐
 browser ──► api-edge ──► 12 bounded-context workers             │
           web-console-next                                     │
                 └──────────────────────┬────────────────────────┘
                                        │ Hyperdrive (cached)  ──┐
 browser ──► apps/cms  (NEW)            │                        ├──► Supabase Postgres
   /admin   Payload admin               │ Hyperdrive-CMS         │     schemas: identity, …
   /api/*   REST + GraphQL  ────────────┘ (cache DISABLED) ──────┘     and  cms  (NEW)
   /health  liveness + database check
```

Nothing in the fleet calls the CMS and the CMS calls nothing in the fleet in
this epic (§6). That is a property, not an omission: no existing worker is
redeployed by any change here.

## 1. The components

| Component | Type | What it owns |
|---|---|---|
| `infra/terraform/cloudflare-hyperdrive-cms` | `terraform` | A Hyperdrive config per environment, `<reponame>-cms-<env>`, with **caching disabled**, over the same Supabase origin as `cloudflare-hyperdrive`; and a generated `payload_secret`. Publishes `WIRING_CLOUDFLARE_HYPERDRIVE_CMS` and `CMS_PAYLOAD_SECRET` as job-output secrets. |
| `packages/db` migration `200_cms_payload_core` | (in `db-migrate`) | Schema `cms` and every table Payload's configuration needs. |
| `apps/cms` | `cloudflare-worker-turbo` | The Payload application, built by `@opennextjs/cloudflare` into `.open-next/worker.js` plus static assets, deployed as `<reponame>-cms-<env>`. |
| `tests/cms` | `turbo-package` | The CMS's verification suite: the setup gate, the access rules, the request-scoped pool, the rendered wrangler config, migration sync. |

**Why `cloudflare-worker-turbo` and not `cloudflare-workers-assets-turbo`.**
The console uses the assets type, whose parameter schema is closed
(`additionalProperties: false`) and has no wiring parameters, so a build on it
cannot bind a Hyperdrive config. `cloudflare-worker-turbo` renders
`wrangler.template.jsonc` against the published wiring at deploy time, and a
wrangler config can itself declare `main` and `assets` — so an OpenNext build
deploys on it unchanged.

**Why a second Hyperdrive config.** Hyperdrive does not invalidate cached reads
when the application writes (Cloudflare's query-caching docs; default
`max_age` 60 s). The fleet tolerates that; an editor who saves a page and
reloads it would not. Cloudflare's own recommendation for reads that must be
fresh is a second, cache-disabled configuration, which is what this is.

**Why the schema is a migration and not `payload migrate`.** `SUPABASE_DB_URL`
is the direct `db.<ref>.supabase.co:5432` host, and Lumen's migration runner
deliberately applies through the Supabase Management API
(`POST /v1/projects/{ref}/database/query`) instead of a direct connection.
`payload migrate` would need that direct connection from a CI runner. Landing
Payload's DDL in the `db-migrate` lane keeps **one** migration authority,
reviewed in pull requests, applied before deploy on every environment.

## 2. The schema

```
cms                         Postgres schema, owned by migration 200
  users                     staff accounts (Payload auth collection)
  users_sessions            Payload auth sessions
  pages                     title, slug (unique), content (Lexical JSON), status, published_at
  posts                     title, slug (unique), excerpt, content, category, status, published_at
  categories                name, slug (unique)
  _pages_v, _posts_v        drafts and versions
  payload_locked_documents  (+ _rels)  edit locks
  payload_preferences       (+ _rels)  admin UI preferences
  payload_migrations        Payload's own bookkeeping, unused at runtime
```

The exact DDL is **generated, not hand-written**: Payload is run once against a
local Postgres 16 with `push: true`, the `cms` schema is dumped, and the dump is
rewritten to idempotent statements (`IF NOT EXISTS`, guarded enum and
constraint creation) in Lumen's migration style. Every later change to a
collection lands the same way, as the next numbered migration.

At runtime the adapter runs with `push: false`: the CMS never alters the schema
itself.

## 3. The application

**Pins.** `payload` and every `@payloadcms/*` package at **3.89.0** exactly;
`next` 16.3.3, `react` 19.2.6, `@opennextjs/cloudflare` 1.20.1, `wrangler`
4.116 — the combination Payload's own `with-cloudflare-d1` template ships at the
`v3.89.0` tag. 3.89.0 is the last release that hashes passwords at a fixed
25,000 PBKDF2 iterations; 3.90.0 hard-codes 600,000, which `workerd` rejects
(PC-C).

**Database adapter.**

```ts
postgresAdapter({
  schemaName: 'cms',
  idType: 'uuid',             // Lumen's convention; lets a migration seed rows with fixed ids
  push: false,
  pg: requestScopedPg,        // on Workers: no client-side pool (below, and PC-A)
  pool: {
    connectionString: env.HYPERDRIVE_CMS.connectionString,
    connectionTimeoutMillis: 10_000,
    query_timeout: 25_000,    // a stuck query fails instead of holding the request
  },
})
```

**No pooling in the Worker.** workerd binds every socket to the request that
opened it. Payload keeps one `pg` pool for the life of the isolate, and
pg-pool hands a waiting request whichever client comes free, including one
whose socket belongs to a request that has already ended; that request then
hangs until the connect timeout and its slot never frees. Hyperdrive already
pools connections to Postgres, so on Workers the adapter gets
`requestScopedPg`, whose `Pool` opens one client per query or transaction from
the caller's own request and closes it on release (`lib/request-scoped-pool.ts`).
Local development and the CLIs keep pg's own pool.

**Collections.** `users` (staff; `auth: true`; roles `admin` and `editor`),
`pages`, `posts`, `categories`. Pages and posts carry drafts and versions and a
Lexical rich-text body. Media arrives in PC4.

**Routes.**

| Route | Owner | Access |
|---|---|---|
| `/admin/**` | Payload admin | staff session |
| `/api/<collection>` | Payload REST | published `pages`, `posts`, `categories` readable anonymously; everything else needs a staff session |
| `/api/graphql` | Payload GraphQL | same rules |
| `/health` | `apps/cms` | anonymous; `{"status":"ok","db":"ok"}` after a `select 1` through Hyperdrive, 503 otherwise |

**Bindings** (in `wrangler.template.jsonc`, per environment): `HYPERDRIVE_CMS`
from `@@wiring(cloudflare-hyperdrive-cms/<env>:hyperdrive_id)@@`; `ASSETS` for
`.open-next/assets`; `ENVIRONMENT` as a var.

**Runtime secrets.** The component names `PAYLOAD_SECRET` and
`CMS_SETUP_TOKEN` in `runtimeSecrets`; the deploy lane's `secrets-live` step
pushes whichever have a value with `wrangler secret bulk`, right after
`wrangler deploy` and before the smoke check. `PAYLOAD_SECRET` resolves from
`CMS_PAYLOAD_SECRET`, which terraform generated in PC1: no person ever types or
sees it. `CMS_SETUP_TOKEN` is the owner's and usually absent (§4).

**Plan.** The CMS needs **Workers Paid**: its bundle is about 3.8 MiB
compressed, over Workers Free's 3 MiB, and Payload's first request in an
isolate needs more than Free's 10 ms of CPU (PC-H).

## 4. Opening the admin: closed by default

A fresh Payload install offers `/admin/create-first-user` to whoever arrives
first. On a public `workers.dev` hostname that is an account takeover window
between the deploy and the owner's first visit. So this CMS ships **closed**:

1. `POST /api/users/first-register` and `/admin/create-first-user` pass only
   with a `cms_setup` cookie equal to the Worker secret `CMS_SETUP_TOKEN`
   (constant-time comparison). Without the secret set, both answer **403** and
   say how to open setup.
2. The owner opens it by setting that secret: as `CMS_SETUP_TOKEN` in the
   workspace's secrets for that environment (the next deploy pushes it), or
   directly with `wrangler secret put CMS_SETUP_TOKEN --name <reponame>-cms-<env>`.
   Then they visit `/setup?token=<token>`, which sets the cookie (HttpOnly,
   SameSite=Strict, 15 minutes) and redirects to `/admin/create-first-user`,
   dropping the token from the URL. Scripts can send the token as the
   `x-cms-setup-token` header instead.
3. Once the first user exists, Payload itself refuses `first-register`, and the
   gate no longer matters. Every other user is created by an admin.

The token is never generated by the pipeline, so there is nothing to print and
nothing to leak: it exists only if the owner made it.

## 5. Verifying it (what "live" means)

```bash
curl -fsS https://<reponame>-cms-<env>.<subdomain>.workers.dev/health          # {"status":"ok","db":"ok"}
curl -s -o /dev/null -w '%{http_code}' https://<reponame>-cms-<env>.<subdomain>.workers.dev/admin   # 200
curl -s -o /dev/null -w '%{http_code}' -X POST https://<reponame>-cms-<env>.<subdomain>.workers.dev/api/users/first-register   # 403
```

The component's `smokeCommand` asserts the first two after every deploy, against
`CMS_URL`, which the component sets per environment.

## 6. Out of scope

- **Single sign-on with Lumen identity.** `workers.dev` is a public suffix, so
  the console's session cookie cannot reach the CMS host; SSO needs either a
  custom domain shared by both or a signed token hand-off through `api-edge`.
  Staff accounts live in Payload until then.
- **Serving content through `api-edge`.** Would add a service binding to the
  edge and make it depend on the CMS deploy. Products read the CMS's own API.
- **Per-tenant content.** The vertical built on this (`multi-tenant-saas-2-lms`)
  adds tenancy for its own model; this baseline's CMS serves the product
  operator.
- **Image derivatives.** `sharp` cannot run on Workers; PC4 stores originals,
  and derivatives through the Images binding are a later epic.
