# lumen-payload-console — risks and open questions

## PX-A — Payload with no local strategy has no login form (SETTLED)

With `disableLocalStrategy`, Payload 3.89 still renders its login view but
without a form, and `first-register` and password reset answer 403. The view is
replaced (`admin.components.views.login`) by the Lumen sign-in page.
`enableFields: true` keeps the auth columns, so the schema only gains
`lumen_user_id` and a role value.

## PX-B — Two records of a person (DECIDED)

A person is a Lumen user (`identity.users`) and a Payload user (`cms.users`).
Lumen is the source of truth for who they are and whether they are signed in;
Payload holds only what the content plane needs (role, display name, the link).
The link is `lumenUserId`. Email is used once, to adopt a pre-existing row with
no link, and never to switch a linked row to another Lumen user.

## PX-C — The Lumen token in a cookie (DECIDED)

The token grants the whole Lumen account for 30 days. It moves from the
console's `localStorage`, which any script on that origin can read, to an
httpOnly, Secure cookie on the CMS host, which no script can read. The risk
left is a sibling Worker on the same `workers.dev` site reading requests to the
CMS host. A sibling cannot do that: a host-only cookie is only ever sent to the
CMS host.

## PX-D — The strategy runs on every admin request (DECIDED)

Payload calls `/api/users/me` on every admin page, and every REST call
authenticates. Each would be one `api-edge` round trip. The strategy caches the
session per isolate for 30 seconds by token hash, the same window `api-edge`
gives its own actor cache.

## PX-E — Sign-in rate limits are per IP (DECIDED)

`api-edge` limits unauthenticated auth calls per client IP. A server-side proxy
through the CMS would put every user in one bucket. Sign-in therefore stays in
the browser, as it is today, and only authenticated calls go server to server.

## PX-F — Solo mode makes every account its own organization (ACCEPTED)

In Solo mode each Lumen account has one personal organization with its own
billing. The Organization and Billing pages show the signed-in person's own,
exactly as the console does. For a customer-owned deployment the owner's
account is the one that pays; editors see their own (empty) plan. Revisit if
Solo mode is turned off.

## PX-G — Stage hands out sign-in codes (ACCEPTED)

`DEBUG_DELIVERY=true` on stage returns the email code in the API response, so
anyone can sign in to stage as any email. Through the CMS that yields a
*pending* account and nothing else. It also makes the stage check automatable.

## PX-H — Retiring the console touches other components (OPEN until PX4)

These depend on the console and change in PX4:
- `cloudflare-domain` (parked) depends on the console Worker;
- `api-edge` and identity-worker list its origin;
- `POLAR_SUCCESS_URL` returns to it;
- `intent.yaml` names its URL.

The console Worker keeps its name as a redirect, so nothing that links to it
breaks. Its code and tests are removed rather than left to rot.

## PX-I — Content per organization (OUT OF SCOPE, recorded)

A hosted multi-tenant CMS, with each Lumen organization getting its own pages
and media, is the shape the proposal rated weakest (§11: isolation 2/5 pooled)
and the one where `payloadcms/payload#17335` becomes a cross-tenant leak. This
epic keeps one content space per deployment. If that changes, it is a new epic
with its own isolation tests.

## PX-J — The LMS inherits (FOLLOW-UP)

`multi-tenant-saas-2` is built on this CMS and has the same console. It ports
the result in its own epic once PX4 is live. Its learner accounts (`learners`)
are a separate auth collection and do not change.
