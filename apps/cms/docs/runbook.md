# cms — runbook

## How it deploys

A merge to `main` that changes `apps/cms` deploys stage, then prod, in the
CMS's own lane, after `cloudflare-hyperdrive-cms` and `db-migrate` for that
environment. The lane builds, renders the wrangler config from the published
wiring, runs `wrangler deploy`, pushes the runtime secrets, and smoke-checks
`/health` and `/admin` (retried for about 4.5 minutes). Pull requests build,
typecheck and dry-run the deploy; nothing deploys from a pull request.

## Sign in

The admin has no passwords of its own. `/admin` shows a Lumen sign-in: an
emailed code, or GitHub or Google where the identity plane has them
configured. The sign-in runs against `api-edge` from the browser; the Lumen
session it returns goes to `/auth/lumen/session`, which puts it in an
HttpOnly `lumen_session` cookie on the CMS host and never shows it to page
scripts. Each request, the `lumen` auth strategy (`src/lib/lumen/`) asks
`api-edge` who the cookie belongs to (cached 30 s) and maps the Lumen user to
a `users` row by `lumenUserId`, creating the row the first time.

A new row has **no role**, which means *pending*: the person is signed in but
sees "Waiting for access" until an admin opens *Users* and makes them an
`editor` or `admin`. A row an admin created beforehand with the same email
(an invitation) is linked on that person's first sign-in and keeps its role:
to invite someone, open *Users → Create new*, enter their email and pick a
role. Signing out (the admin's log-out button) revokes the Lumen session too.

## Your account

The admin's nav has an **Account** group: the same Lumen account pages the
console had, for admins and editors (a pending account sees none of them).
Each page reads Lumen through `api-edge` with the person's own session when it
loads; forms post to `/lumen/*` on the CMS, which calls `api-edge` and comes
back to the page with *Saved.* or what went wrong.

| Page | Path | Shows | Changes |
|---|---|---|---|
| Profile | `/admin/account` (Payload's account page, replaced) | email, CMS role, Lumen user id | display name (copied onto the `users` row) |
| Security activity | `/admin/account/security` | sign-ins, codes and sessions, newest first, 50 a page | — |
| Organization | `/admin/organization` | the Lumen organization (Solo: the personal one) | — (renaming is not in the API) |
| Notifications | `/admin/organization/notifications` | email categories for that organization | which categories Lumen emails |
| Billing & plan | `/admin/organization/billing` | the plan, its status and renewal, what it includes, invoices | upgrade (the provider's checkout), switch or cancel a paid plan, the provider's portal |

Paying never happens in the CMS: *Upgrade* sends the browser to the payment
provider's checkout, which returns to Billing & plan (`?checkout=complete`);
the page then posts one reconcile, so it does not wait for the provider's
webhook. *Manage payment and invoices* opens the provider's
customer portal; it appears only for a paid subscription the provider manages.

A page that cannot reach Lumen says so (for example *The CMS could not reach
Lumen*) instead of failing: check `api-edge` and the `LUMEN_API` binding.

## Open the admin (first admin)

Nobody becomes an admin by signing in, except through setup, which the owner
opens. Once per environment:

1. Choose a token of at least 16 characters, and keep it to yourself.
2. Give it to the Worker, either way:
   - in the workspace's secrets as `CMS_SETUP_TOKEN`, for that environment or
     on the workspace-shared rung (both environments read it). The CMS's next
     deploy pushes it to the Worker: run the on-demand deploy (Actions → CI →
     Run workflow, component `cms`, environment `stage` or `prod`), or merge any
     change under `apps/cms`. Re-running an earlier run does not deploy: the
     lane's recorded result is reused; or
   - directly: `pnpm exec wrangler secret put CMS_SETUP_TOKEN --name lumen-payload-cms-<env>`
     (it prompts for the value).
3. Visit `https://lumen-payload-cms-<env>.nexo-7be.workers.dev/setup?token=<token>`.
   It sets a 15-minute cookie and sends you to the sign-in page.
4. Sign in with your Lumen account. While no admin exists, the account that
   signs in with that cookie becomes the admin (a pending account is promoted).
   From then on, admins give everyone else their role in *Users*, and setup
   changes nothing.

You can delete `CMS_SETUP_TOKEN` afterwards; nothing needs it.

## Verify

```bash
B=https://lumen-payload-cms-stage.nexo-7be.workers.dev
curl -fsS $B/health                                   # {"status":"ok","db":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' $B/admin      # 200, the Lumen sign-in
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/users/login \
  -H content-type:application/json -d '{"email":"x@example.com","password":"x"}'   # 403: no passwords
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/users/first-register \
  -H content-type:application/json -d '{"email":"x@example.com","password":"x"}'   # 403
curl -fsS "$B/api/pages?limit=5"                      # published pages only
curl -fsS "$B/api/media?limit=5"                      # media, anonymously readable
```

## Media

Staff upload images (JPEG, PNG, GIF, WebP, AVIF) and PDFs in *Media* in
`/admin`, or embed them from a page's or post's rich text. Each upload needs
alt text and is at most 10 MiB; SVG is refused. Files are stored in the
environment's R2 bucket (`stg-lumen-payload-cms-media-stage`,
`prod-lumen-payload-cms-media-prod`; `infra/terraform/cloudflare-r2-cms`) and served at
`/api/media/file/<filename>` to anyone. A second file with the same name gets
a suffix (`photo-1.jpg`). Only admins delete media; deleting removes the
object from the bucket too.

```bash
# as staff: the lumen_session cookie of a signed-in browser (a Lumen session token)
curl -H "Cookie: lumen_session=<token>" -F "file=@photo.jpg;type=image/jpeg" \
  -F '_payload={"alt":"What the photo shows"}' "$B/api/media"
curl -fsS -o /dev/null -w '%{http_code}\n' "$B/api/media/file/photo.jpg"   # 200
```

## Change a collection

1. Edit the collection in `src/collections/` and run the app locally (below).
2. `PAYLOAD_SECRET=local-only DATABASE_URL=<local db with every migration applied> pnpm payload migrate:create <name>`
   writes a migration and snapshot to `payload-migrations/` (Payload will not
   start without a secret; any value does locally).
3. Convert it: `node scripts/payload-migration-to-sql.mjs payload-migrations/<file>.ts > ../../packages/db/src/migrations/<id>/up.sql`.
   Exit code 2 means a statement could not be made idempotent (a drop, rename
   or type change): rewrite it by hand into a safe, re-runnable form and say so
   in the pull request.
4. Add `<id>` to `packages/db/src/manifest.ts` with `context: "cms"` and the
   file's sha256, and to `CONVERTED` in `tests/cms/src/migration-sync.test.ts`.
5. `pnpm generate:types` and `pnpm generate:importmap` if fields or admin
   components changed.
6. Prove the SQL is exactly Payload's schema: apply every migration to one
   empty database, let Payload push its schema into another
   (`PAYLOAD_SECRET=x PAYLOAD_PUSH=true DATABASE_URL=<empty db> pnpm payload run scripts/init-payload.ts`),
   and compare `pg_dump -s -n cms` of the two (ignore the `\restrict` lines).
   They must be identical; re-applying the new migration must succeed too.

## Run it locally

```bash
# Postgres 16 on 127.0.0.1:54329 with a database `cms`, then:
export DATABASE_URL=postgres://postgres:<pw>@127.0.0.1:54329/cms
for m in 200_cms_payload_core 205_cms_media 206_cms_lumen_identity; do psql "$DATABASE_URL" -f ../../packages/db/src/migrations/$m/up.sql; done
pnpm dev                                        # Node, http://localhost:3002; uploads go to a local folder

# The real runtime (workerd), after `pnpm build`:
node ../../tooling/wire/render.mjs --template wrangler.template.jsonc --out wrangler.jsonc --map wiring.fixture.json
# no api-edge runs locally: drop env.stage.services from wrangler.jsonc, and
# point the CMS at stage's api-edge instead
printf 'PAYLOAD_SECRET=%s\nCMS_SETUP_TOKEN=%s\nLUMEN_API_URL=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 16)" \
  https://lumen-payload-api-edge-stage.nexo-7be.workers.dev > .dev.vars
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_CMS="$DATABASE_URL" \
  pnpm exec wrangler dev --config wrangler.jsonc --env stage --port 8799 --ip 127.0.0.1
```

`wrangler dev` needs a password in the local connection string. Without the
`LUMEN_API` service binding the CMS reaches `api-edge` over `LUMEN_API_URL`.
Stage's `api-edge` accepts `http://127.0.0.1:<port>` and shows the emailed
code on the sign-in page, so a local sign-in needs no inbox. It serves
`R2_MEDIA` from a local bucket under `.wrangler/state`, so uploads exercise the
real R2 adapter.

## Common failures

- **Smoke: `/health` answers 503.** The body names the part that failed, and
  the Worker's logs (observability is on) carry the error:
  - `{"secret":"missing"}`: `PAYLOAD_SECRET` is not on the Worker. `secrets-live`
    pushes it right after `wrangler deploy`; if it reported the secret as "not
    seeded", `cloudflare-hyperdrive-cms` has not published `CMS_PAYLOAD_SECRET`
    for that environment yet.
  - `{"payload":"error"}`: Payload could not start, which on a deployed Worker
    is almost always the database being unreachable at startup.
  - `{"db":"error"}`: Payload started but the query failed: check that
    `cloudflare-hyperdrive-cms` applied, that the deploy rendered the right
    `HYPERDRIVE_CMS` id, and that db-migrate applied migration 200.
- **Deploy: "Authentication error [code: 10000]" on `/r2/buckets/<name>`.**
  Wrangler's resource provisioning checked the bucket with the brokered
  `workers-deploy` token, which has no R2 permission. `skipResourceProvisioning:
  true` in `component.yaml` turns that check off (stack-tectonic 0.21.0 and
  later); check it is still set and the stack pin in `intent.yaml` has not
  gone back below 0.21.0. The bucket itself comes from `cloudflare-r2-cms`.
- **Uploads fail with "R2_MEDIA binding is missing".** The deploy rendered no
  `R2_MEDIA` binding: check that `cloudflare-r2-cms` applied for that
  environment and published `WIRING_CLOUDFLARE_R2_CMS`, then redeploy the CMS.
- **An upload answers 413.** It is over 10 MiB (`MEDIA_MAX_BYTES` in
  `src/collections/Media.ts`).
- **Billing & plan says "no payment provider is configured".** The billing
  worker of that environment has no provider credentials (stage, today), so
  checkout and the portal cannot start; plans, entitlements and invoices
  still show.
- **An account page says "Lumen answered with an error (internal_error)".**
  api-edge or the worker behind it failed; its logs carry the request id.
  Security activity answered 503 for everyone until identity-worker queried
  events by the user's UUID rather than its public `usr_` id (PX2).
- **Deploy: "exceeds the size limit" or CPU errors (1102).** The account is on
  Workers Free. The CMS needs Workers Paid.
- **Requests hang for 10 s, then 500.** A regression to a shared pool: the
  adapter must get `requestScopedPg` on Workers (`src/payload.config.ts`), and
  `cms-tests`' `request-scoped-pool` suite should have caught it.
- **Build: "Failed to collect configuration … connectionString".** Something at
  build time reached for the binding: `src/lib/runtime.ts` must keep
  `NEXT_PHASE=phase-production-build` out of the Workers branch.
