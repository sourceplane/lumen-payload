# lumen-payload-cms — risks and open questions

## PC-A — Payload's shared Postgres pool on Workers (RESOLVED)

`payloadcms/payload#17335` is open with no fix: Payload caches its instance,
pool included, on a global, and Workers reuse an isolate across unrelated
requests. When a slow query outlives the request that started it, the runtime
reports a promise resolved from a different request context, cancels the
request as hung (Error 1101), and can leave the pool unusable for later
requests on that isolate. The report describes hung requests and a corrupted
pool — **not** one request receiving another's data — and that is the risk this
epic carries.

It reproduced locally, in workerd against a real Postgres, with the pool
tuned as first planned (`max: 3`, `maxUses: 1`, a 1 ms idle timeout): under a
burst of 40 concurrent requests, 38 health checks answered 503 and every list
request 500, each after exactly the 10 s connect timeout, and the isolate
stayed broken afterwards. The cause is pg-pool itself: when a request releases
a client (or a slot frees), pg-pool connects the next waiter's client from
inside the releasing request, so the socket belongs to a request that is about
to end. Tuning only changes how soon it breaks.

**Decided:** no client-side pool on Workers. Payload's adapter accepts its `pg`
module (`postgresAdapter({ pg })`), and the CMS passes one whose `Pool` opens a
client per query or transaction from the caller's own request and closes it on
release (`apps/cms/src/lib/request-scoped-pool.ts`, unit-tested in
`tests/cms`). Hyperdrive does the pooling to Postgres, which is what it is for.
With it, the same burst plus 10 concurrent writes answers 80/80, the isolate
stays healthy, and no connection is left open. No patch to Payload is needed.

## PC-B — Payload's schema in the db-migrate lane (RESOLVED)

Options were `payload migrate` in the deploy lane, Payload's `prodMigrations`
on first request, or Payload's DDL as Lumen migrations. The first needs a
direct database connection from a CI runner, which Lumen's runner deliberately
avoids by applying through the Supabase Management API. The second races
across isolates and makes the first request after a deploy slow. **Decided:**
generated DDL in `db-migrate`, in schema `cms`. One migration authority;
every schema change reviewed in a pull request; the CMS runs `push: false`.
The cost is a manual step per collection change (regenerate, rewrite to
idempotent form, add the migration), which is what Lumen's own contexts do.

## PC-C — Payload pinned to 3.89.0 (ACCEPTED)

3.90.0 hard-codes `currentPasswordHashIterations = 600000`
(`auth/strategies/local/generatePasswordSaltHash.js`); 3.89.0 uses 25,000.
`workerd` rejects the larger count. Carrying 3.89.0 means staying off later
fixes, and 25,000 PBKDF2-SHA256 iterations is below OWASP's current 600,000
recommendation. Accepted because the alternative is no Payload on Workers at
all; revisit when Payload makes the count configurable or `workerd` raises its
limit.

## PC-D — A second Hyperdrive config per environment (SETTLED)

Two configs per environment instead of one. Cloudflare allows 25 per account,
and the Cloudflare account behind this workspace may host other products (the
LMS built on this baseline uses the same `workers.dev` subdomain). Settled for
now; revisit if the account approaches the limit.

## PC-E — The admin is closed until the owner opens it (RESOLVED)

A public first-user form is an account-takeover window. Options were accepting
the window, seeding an admin from a generated password (unreadable to the
owner, by design of the secrets model), or an owner-held setup token.
**Decided:** the setup token. It costs the owner one secret and one visit, and
it means the pipeline never holds a credential it would have to show someone.

## PC-F — Media needs a token this workspace does not have (RISK)

The `workers-deploy` token cannot create R2 buckets. PC4 waits on an
`r2-data` mint. Until then the CMS has no uploads; nothing else depends on PC4.

## PC-G — `workers.dev` and the subdomain in smoke checks (ACCEPTED)

`cloudflare-worker-turbo` exposes no `workersDevSubdomain` parameter, so the
smoke URL carries the subdomain literally. A product built from this baseline
under a different account must change it there; the rebrand values record the
subdomain, so the same substitution applies.

## PC-H — Workers Paid is a prerequisite (RISK, owner action)

Three Workers Free limits stop this baseline: 5 cron triggers per account (the
fleet's own bootstrap hit this before the CMS existed), 3 MiB per Worker
compressed (the CMS is 3.3 MiB in CI's dry-run deploy), and 10 ms of CPU per request (Payload's
first request in an isolate builds its config and schema well beyond that).
Workers Paid lifts all three (30 s CPU, 10 MiB). The owner upgrades the
Cloudflare account once; nothing in the repository can.

## PC-I — The `tests/*` suites do not run in CI (FOUND, worked around for the CMS)

In stack-tectonic 0.20.0 the turbo-package job guards each command on the bare
name (`.preBuildCommand`, `.buildCommand`, `.typecheckCommand`) rather than
`.parameters.<name>`, so all three parameters are ignored: `pre-build` never
runs, and `build` and `typecheck` always run `turbo run build|typecheck
--filter=./`. The `quick-check` profile the existing suites subscribe to runs
neither. So no suite under `tests/` gates a merge today. Separately, `dependsOn`
orders components but does not mark a dependent changed, so a suite keyed on
its own path never runs for a change to the code it tests.

For the CMS: `tests/cms`'s own `build` script runs the suite, the component
subscribes on `verify`, and the `cms` component's `buildCommand` (the worker
composition renders it correctly) runs the suite too, so every pull request that
touches the CMS runs it. Turning the other suites on is a separate change,
because it may surface failures that have gone unseen; the newer stack-tectonic
fixes the guards.

## PC-J — The first landing of a wiring source races across environments (FOUND, avoided here)

The CMS's `wrangler.template.jsonc` names both environments' Hyperdrive ids, so
`wire-live` needs the wiring of stage **and** prod in every CMS deploy. But
`dependsOn` orders only within one environment: `cms.stage` waits for
`cloudflare-hyperdrive-cms.stage`, not for prod. When the wiring source and the
CMS land in the same push, the stage CMS lane can resolve its secrets before
the prod apply publishes, find the prod wiring empty (it is optional), and
stop in `wire-live`; prod then fails behind it. multi-tenant-saas-2 hit exactly
this when it landed the whole layer in one pull request, and one re-run of the
failed lanes converged it. This repository landed the Hyperdrive component
first (PC1, its own merge), so the CMS never deployed before both wirings
existed. Any later product built from this layer should keep that order.
