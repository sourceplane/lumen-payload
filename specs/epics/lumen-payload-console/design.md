# lumen-payload-console — design

## 0. What changes, and what does not

Today a visitor to lumen-payload meets two products:

| | URL | Accounts | What it shows |
|---|---|---|---|
| The Lumen console | `lumen-payload-web-console-next-<env>` (the product URL in `intent.yaml`) | Lumen accounts, a 30-day bearer token in `localStorage` | Solo mode: the personal organization's settings, billing and plan, notifications; the account and its security activity |
| The Payload admin | `lumen-payload-cms-<env>/admin` | its own `cms.users`, a password, a `payload-token` cookie | pages, posts, categories, media |

After this epic there is one: the Payload admin, at the product URL, signed in
with a Lumen account, with the Lumen pages inside it. What stays:

- **Every worker behind `api-edge`**, and `api-edge` itself. The CMS becomes one
  more client of the public API, like the console was. Identity, membership,
  billing and notifications keep their rules; nothing is re-implemented in
  Payload.
- **Solo mode.** `api-edge` keeps suppressing projects, usage, members,
  invitations, API keys, webhooks and integrations, so none of them is ported.
- **The CMS as `lumen-payload-cms` built it:** its Hyperdrive config, schema
  `cms`, media on R2, its collections and their access rules.
- **One content space per deployment.** This is a customer-owned deployment
  (proposal §16): staff of the one product edit one site. Separate content per
  Lumen organization is out of scope (§8).

## 1. Sign-in

Payload's local strategy is turned off (`auth.disableLocalStrategy: {
enableFields: true }` on `users`, so no column changes), which removes the
password form, `first-register` and password reset. The admin's login view is
replaced (`admin.components.views.login`) by **Sign in with your Lumen
account**:

| Way | Steps |
|---|---|
| Email code | The page calls `api-edge` from the browser, as the console does: `POST /v1/auth/login/start {email}`, then `POST /v1/auth/login/complete {challengeId, code}` → `{token, expiresAt, user}`. The page posts the token once to the CMS's `POST /auth/lumen/session` and forgets it. |
| GitHub, Google | `GET /v1/auth/oauth/providers` lists them. The button navigates to `api-edge` `/v1/auth/oauth/<provider>/start?return_to=<cms>/auth/lumen/callback`. identity-worker redirects back to `/auth/lumen/callback#token=…`; that page reads the fragment, removes it from history, and posts the token to `/auth/lumen/session`. |

Why the browser and not the CMS server: `api-edge` rate-limits unauthenticated
auth calls per client IP. Proxied through the CMS Worker, every sign-in would
share one bucket. So sign-in stays where it is today. `api-edge` CORS gains
the CMS origin, and identity-worker's `OAUTH_ALLOWED_CONSOLE_ORIGINS` gains the
CMS origin for the return.

`POST /auth/lumen/session` (CMS route, same origin only):

1. It validates the token with `GET /v1/auth/session` (bearer) and gets `{session, user}`.
2. It sets **`lumen_session`** = the token, `HttpOnly; Secure; SameSite=Lax; Path=/`,
   with `Max-Age` up to the Lumen session's own expiry (30 days). The cookie is
   host-only on the CMS host, and nothing else stores the token.
3. It answers `303` to the `redirect` the admin asked for, which must be a
   relative path under `/admin`.

**Sign-out** (`POST /auth/lumen/logout`, which the admin's logout button
posts to):

1. It calls `POST /v1/auth/logout` with the token, which revokes the session
   server-side, unlike most of today's console, which only forgets it.
2. It clears the cookie.
3. It answers `303` to `/admin/login`.

## 2. The strategy and the session

`users.auth.strategies = [lumen]`. On every request the admin, REST and
GraphQL make, the strategy:

1. Reads `lumen_session` from the request's cookies. If there is none, it returns `{ user: null }`.
2. Resolves it with `GET /v1/auth/session` over a **service binding**
   (`LUMEN_API` → `lumen-payload-api-edge-<env>`). That call is authenticated,
   so `api-edge` rate-limits it per token, and it never leaves Cloudflare.
3. Caches the answer per isolate for **30 seconds**, keyed on
   `sha256(token)`, the same window `api-edge` uses for its own actor cache. A
   revoked session stops working within 30 seconds.
4. Maps the Lumen user to a `users` row (§3) and returns
   `{ ...doc, collection: 'users', _strategy: 'lumen' }`.

The token is never put on `req.user`, because Payload hands `req.user` to the
browser. The account pages read the cookie themselves (`lumenTokenFrom(req)`,
server only).

## 3. Accounts and roles

`users` gains **`lumenUserId`** (`usr_…`, unique, read-only) and a third role,
**`pending`**, which becomes the default. These come from migration
`206_cms_lumen_identity`, converted like every CMS migration. Mapping a
signed-in Lumen user:

1. **A row with that `lumenUserId`:** that is the user.
2. **A row with the same email and no `lumenUserId`:** link it. This covers
   accounts made before this epic; stage and prod have none.
3. **Otherwise:** create one with `email`, `name` (the Lumen display name) and
   `lumenUserId`.
   - If **no admin exists and the request carries a valid setup cookie**, the
     role is `admin`. The owner opens setup with `CMS_SETUP_TOKEN`, exactly as
     today.
   - Otherwise the role is `pending`.
   - The same rule promotes an existing *pending* user who signs in through
     setup while there is still no admin.

`access.admin` lets in `admin` and `editor` only. A pending user who signs in
sees a short page, *Signed in as … — an admin has to give you access*, with a
sign-out button; that is Payload's `unauthorized` view replaced. Admins change
roles in *Users*, as before. Signing up for Lumen therefore never grants access
to anyone's content.

The existing `firstUserGate` and `firstUserIsAdmin` hooks go: they guarded
`first-register`, which no longer exists. Their rule (the first admin needs
the setup token) moves into step 3.

## 4. Lumen pages inside the admin

Each page is a custom admin view: a server component that checks `req.user`
and `canAccessAdmin` itself (Payload does not for custom views), renders inside
Payload's `DefaultTemplate` (nav, header), and calls `api-edge` server-side
with the cookie's token through `@saas/sdk`. They appear under an **Account**
group in the nav (`admin.components.afterNavLinks`).

The pages and the `api-edge` calls behind them:

| Page | Path | Reads | Changes |
|---|---|---|---|
| Profile (replaces Payload's `account` view) | `/admin/account` | `GET /v1/auth/profile` | display name: `PATCH /v1/auth/profile` |
| Security activity | `/admin/account/security` | `GET /v1/auth/security-events?cursor` | — |
| Organization | `/admin/organization` | `GET /v1/organizations` (Solo: the one personal org) | — (renaming is not in the API) |
| Notifications | `/admin/organization/notifications` | `GET /v1/notifications/preferences?orgId` | `PUT /v1/notifications/preferences` |
| Billing & plan | `/admin/organization/billing` | `GET O/billing/{summary,entitlements,invoices,plans}` | `POST O/billing/{checkout,portal,reconcile}`, `POST O/billing/subscription/{change,cancel}` |

`O` is `/v1/organizations/:orgId`.

Changes go through CMS route handlers under `/lumen/…`. The page's form posts
to them, and each handler:

- accepts only same-origin requests (the `Origin` header must be the CMS);
- accepts only a Payload user with access;
- calls `api-edge` with the token and answers `303` back to the page, with a
  status line.

Checkout and the portal answer with the payment provider's URL; the handler
redirects there, and the provider returns to the billing page. The billing
return goes from the console root to the CMS billing page (PX4). Read-only
data is fetched per request, with no cache: these pages are low-traffic and
must show the truth.

The console's pure, unit-tested models are reused where they are framework-free:
- `billing/plan-actions.ts`
- `notifications/preferences.ts`
- `security/security-events.ts`
- `account/profile.ts`

Its React components are not: Payload's admin is `@payloadcms/ui` and SCSS,
not Tailwind and Radix.

## 5. The front door

- **The CMS root** `/` redirects to `/admin`. The CMS's own landing page goes;
  `/admin` keeps its path, which is smaller than moving Payload's generated
  routes to the root.
- **The Lumen console** keeps its Worker name and URL and answers every path
  with a `308` to the same path's place in the CMS: `/` and anything unknown
  go to `/admin`, and `/auth/callback` goes to `/auth/lumen/callback`
  (fragment kept by the browser). Bookmarks and old links land in Payload. Its
  UI and tests are removed in the same change. The parked
  `cloudflare-domain` component, which depends on the console Worker, is
  pointed at the CMS.
- **The product URL** in `intent.yaml` (`stage.url`, `prod.url`) becomes the
  CMS URL.
- **The billing provider's fallback return** (`POLAR_SUCCESS_URL`) becomes
  the CMS billing page.
- **Branding.** The admin's title reads *Lumen Payload*
  (`admin.meta.titleSuffix`), and its logo and icon are the product's mark,
  from `.rebrand/values.json` (read, not edited).

## 6. Security

- **Custody of the Lumen token.** It is in browser memory only for the moment
  between sign-in and the post to `/auth/lumen/session`, which is shorter than
  today, where `localStorage` keeps it for 30 days. After that it lives in an
  httpOnly cookie on one host, is sent to `api-edge` only by the CMS server,
  and never appears on `req.user` or in logs.
- **CSRF.** The cookie is `SameSite=Lax`. Payload's `csrf` allowlist is set to
  the CMS origin; it is empty today, which accepts cookie auth from any
  origin. Every `/lumen/…` and `/auth/lumen/…` POST also checks `Origin`.
  Sibling Workers on `nexo-7be.workers.dev` share the site, so SameSite alone
  would not separate them.
- **identity-worker has no public URL** (sourceplane/lumen-payload#20). The
  strategy relies on `api-edge` being the only way in.
- **Stage hands out sign-in codes** (`DEBUG_DELIVERY=true`). On stage anyone
  can sign in as any email. That only ever yields a *pending* account, and
  stays a stage property.
- **The request-scoped Postgres pool** (`requestScopedPg`) is unchanged. The
  strategy's lookups use `req.payload` like everything else.

## 7. Verifying it

On stage, through the API and a browser:

1. `/admin` redirects to the Lumen sign-in page; a password form is nowhere.
2. An email-code sign-in (stage returns the code) lands on the *pending* page.
3. With setup opened (`/setup?token=…`), the same sign-in lands in the admin
   as admin. A second account signs in as *pending*, and the admin makes it an
   editor.
4. Profile: the display name changes in the admin and `GET /v1/auth/profile`
   shows it.
5. Billing & plan shows the plan, and *Manage plan* reaches the provider.
6. Sign-out: `GET /v1/auth/session` with the old token answers 401.
7. The Lumen console URL lands in the Payload admin.

Prod is verified read-only: the sign-in page renders, `/health` is ok, and the
console URL redirects.

## 8. Out of scope

- **What Solo mode hides**: projects, environments, usage and quotas, members
  and invitations, API keys, webhooks, integrations, audit. They stay off at
  the edge; turning Solo mode off is its own decision, and would bring them
  back as more admin pages.
- **Config** (settings, feature flags, secrets) is reachable in Solo mode and
  the console shows it; it is a later admin page.
- **Content per Lumen organization** (a hosted multi-tenant CMS, proposal
  §11). This deployment has one content space. Scoping collections by
  organization is a separate epic with its own isolation questions
  (`payloadcms/payload#17335`).
- **The LMS** (`multi-tenant-saas-2`) inherits this in its own epic. Its
  learners keep their own `learners` accounts; only staff move to Lumen
  sign-in.
- **A custom domain.** Everything stays on workers.dev.
