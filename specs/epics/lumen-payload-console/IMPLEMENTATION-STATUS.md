# lumen-payload-console (PX) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| PX0 — the spec | Merged | sourceplane/lumen-payload#21 |
| PX1 — Lumen sign-in | Merged; stage partly deployed, the rest waits on the credential-mint quota | sourceplane/lumen-payload#22 |
| PX2 — your account and organization | In review | — |
| PX3 — billing and plan | In review | — |
| PX4 — the front door | Not started | — |
| PX5 — the record | Not started | — |

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
