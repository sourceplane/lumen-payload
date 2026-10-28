# lumen-payload-console (PX) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| PX0 — the spec | Shipped | sourceplane/lumen-payload#21 |
| PX1 — Lumen sign-in | Shipped; live on stage and prod | sourceplane/lumen-payload#22 |
| PX2 — your account and organization | Shipped; live on stage and prod | sourceplane/lumen-payload#23 |
| PX3 — billing and plan | Shipped; live on stage and prod | sourceplane/lumen-payload#24 |
| PX4 — the front door | Shipped; live on stage and prod | sourceplane/lumen-payload#25 |
| PX5 — the record | Shipped | this change |

## Live verification (2026-10-28)

Each milestone was checked against the deployed Workers after its merge,
with a Playwright run against stage's CMS and its real api-edge (stage shows
the sign-in code, so a test account can sign in):

- **PX1, stage: 35/35.** A newcomer signs in and waits as pending; sign-out
  revokes the Lumen session; the owner's setup token opens the first admin,
  who promotes the newcomer; the OAuth return path; the session hand-in
  refuses another origin, no origin and bogus tokens; a sibling Worker on the
  same site cannot write with the admin cookie; first-register and password
  login answer 403. The setup token was then revoked, and the owner's own
  account was invited as admin.
- **PX2, stage: 26/26.** The Account nav group; the display name saved and
  read back from Lumen and the `users` row; security activity listing this
  sign-in (after the identity-worker fix); the organization; a notification
  category off and back on, read back from Lumen; cross-origin and pending
  posts refused; 15 own-session reads in a row all answer 200 (the `account`
  rate family).
- **PX3, stage: 11/11.** Plan, plans, entitlements and invoices render; Upgrade
  comes back with stage's explanation (no payment provider there); the
  checkout return posts one reconcile; opening the return link alone writes
  nothing.
- **PX4, stage and prod.** The console URL's `/`, `/login`, `/account`,
  `/orgs/<slug>/billing` and `/auth/callback?…` answer 308 to `/admin`,
  `/admin/login`, `/admin/account`, `/admin/organization/billing` and
  `/auth/lumen/callback?…` (query kept) on the same environment's CMS;
  following the console URL lands on the CMS sign-in, titled *Login — Lumen
  Payload*; the CMS root redirects to `/admin`.
- **Prod, read-only:** `/health` ok, `/admin` shows the Lumen sign-in,
  password login and `/setup` without the owner's token answer 403. Prod's
  first admin waits for the owner.

**A note on the browser runs.** In the sandbox that ran these checks,
Chromium's requests for the admin's route chunk
(`/_next/static/chunks/app/(payload)/admin/%5B%5B...segments%5D%5D/page-*.js`)
came back as a 307 to the same URL, looping, while byte-identical requests
from curl, Python and Node got 200 from the same edge (and the
multi-tenant-saas-2 CMS, without these changes, behaved the same). The runs
therefore fetched `/_next/static/**` through Playwright's own network stack.
If a person's browser ever shows `ERR_TOO_MANY_REDIRECTS` on `/admin`, this is
where to look.

## Departures from the design

- **PX1, CSRF.** Design §6 sets Payload's `csrf` allowlist to the CMS origin.
  That allowlist only guards Payload's own `payload-token` cookie, whose
  strategy is off once `disableLocalStrategy` is set, so setting it would
  guard nothing. The `lumen` strategy does the same job for the Lumen cookie
  itself: a request whose `Origin` names another host gets no user
  (`isForeignOrigin`, `src/lib/lumen/cookies.ts`), which also separates
  sibling Workers on the same workers.dev site.
- **PX1, the same-origin check behind `wrangler dev`.** Local `wrangler dev`
  rewrites the request URL's host to `localhost`, so `/auth/lumen/session`
  also accepts an `Origin` equal to the request's scheme with its `Host`
  header. A page elsewhere cannot set `Host`.
- **PX1, migration 206.** Payload adds `lumen_user_id` at the end of `users`,
  while its push of a fresh schema puts it after `role`. The two schemas are
  identical apart from that column order, which nothing reads.
- **PX2, the API client.** Design §4 calls api-edge "through `@saas/sdk`".
  The CMS uses its own small client (`src/lib/lumen/client.ts`, from PX1),
  which takes the service binding as its transport, and types from
  `@saas/contracts` (a type-only dependency): the SDK would be a second HTTP
  layer for the same handful of routes.
- **PX2, identity-worker fix.** `GET /v1/auth/security-events` answered 503
  for everyone: it queried the UUID `user_id` column with the public `usr_`
  id. It now converts the id first, as every other handler does. The
  baseline's identity-worker has the same bug.
- **PX2, api-edge rate limits.** The design left api-edge unchanged, but its
  `auth` family allowed a bearer 10 requests a minute, shared by the CMS's
  session re-checks and the account pages, which could sign a busy editor
  out. A bearer reading its own session, profile or security events (or
  saving its profile) is now the `account` family, 60 a minute; sign-in,
  OAuth, logout and anonymous calls keep 10. The tight cap never slowed
  token guessing, since the bucket is keyed on the bearer itself. The CMS
  also shares one lookup between concurrent requests and keeps a session
  api-edge confirmed in the last 5 minutes while api-edge cannot answer.
- **PX2, framing.** Every CMS response carries `frame-ancestors 'self'`;
  design §6 had not covered framing by a sibling Worker on the same site.
- **PX2, signed-out redirects.** A custom view's redirect to the sign-in is
  sent inside the streamed page (Next's `NEXT_REDIRECT`), which the browser
  follows; the response itself is `200`, as for Payload's own guarded views.
- **PX3, the checkout return.** Opened with `?checkout=complete`, the page
  submits one same-origin reconcile post (`FinishCheckout`), as the console's
  billing actions reconciled once, instead of polling the summary; opening a
  link changes nothing by itself. Embedded checkout (the provider's overlay) is not
  used: the CMS sends the browser to the hosted checkout, which returns to the
  page.
- **PX3, stage has no payment provider.** Stage's billing worker answers
  `provider_unavailable` for the portal and `plan_not_purchasable` for
  checkout, so on stage *Upgrade* comes back with that explanation; the
  provider's pages could not be reached there.
- **PX4, the console Worker.** It is a plain Worker compiled by `tsc` under
  the same component, composition, lane and Worker name, rather than a
  Next.js app with a redirect middleware. It serves only its own
  `lumen-payload-web-console-next-<env>` hosts. The redirect tests run in the
  console's own build, because `tests/web-console-next`'s lane (quick-check)
  runs no tests. The smoke check now asserts the 308 and follows it into the
  CMS.
- **PX4, the billing fallback return.** `POLAR_SUCCESS_URL` is the CMS billing
  page on workers.dev, no longer a custom-domain placeholder, so it left the
  "Setting the domain later" list.
- **Operations: rotated Cloudflare tokens.** PX1's deploy ran out of the
  workspace's 200 credential mints per rolling 24 hours: every CI job minted
  fresh Cloudflare tokens, and the account-id fact counted as a mint too.
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_HYPERDRIVE_TOKEN` now live at the
  project rung as rotated secrets (minted once, re-minted every 30 days),
  shadowing the workspace's brokered bindings. In Orun Cloud, fact templates
  no longer count toward the limit and the orphan sweep now deletes expired
  minted tokens hourly (sourceplane/orun-cloud#2106, with its follow-up
  sourceplane/orun-cloud#2112), and the identity-worker fix from PX2 landed in
  the baseline too (sourceplane/orun-cloud#2114).
- **PX4, branding.** The admin's title suffix is *Lumen Payload*, and the
  logo and icon are a glyph with the product name, drawn in the admin's text
  colour. `.rebrand/values.json` carries a name, not a logo file.
