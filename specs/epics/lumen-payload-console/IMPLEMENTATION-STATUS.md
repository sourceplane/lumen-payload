# lumen-payload-console (PX) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| PX0 — the spec | Merged | sourceplane/lumen-payload#21 |
| PX1 — Lumen sign-in | In review | — |
| PX2 — your account and organization | Not started | — |
| PX3 — billing and plan | Not started | — |
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
