# lumen-payload-console — implementation plan

Each milestone is one task with its contract in `tasks/`, one pull request, and
a live check after its merge. One milestone is in flight at a time. The order
keeps the product usable throughout: Payload gains the Lumen pages first, and
the console URL moves only in PX4, once everything the console showed is in
the admin.

## PX0 — the spec

This doc set. **Done when** it is on `main`.

## PX1 — Lumen sign-in

- `users`:
  - `auth.disableLocalStrategy: { enableFields: true }` and the `lumen` strategy
  - `lumenUserId`
  - the `pending` role, now the default
  - `access.admin` for admin and editor only
- Migration `206_cms_lumen_identity`, converted from Payload's migration.
- The sign-in view (email code, GitHub, Google), `/auth/lumen/callback`,
  `/auth/lumen/session` and `/auth/lumen/logout`.
- The pending page (Payload's `unauthorized` view replaced) and the logout
  button.
- The setup rule moves into account provisioning; `firstUserGate` and
  `firstUserIsAdmin` go.
- Wiring: the `LUMEN_API` service binding and Payload's `csrf` allowlist.
- In other components:
  - `api-edge` CORS and identity-worker `OAUTH_ALLOWED_CONSOLE_ORIGINS` gain
    the CMS origin
  - `tests/api-edge` and `tests/identity-worker` cover the new origin
- `tests/cms` covers the strategy (cache, mapping, roles, setup rule, no token
  on the user), the session route (origin check, redirect check, cookie
  attributes) and logout.

**Done when:**
- on stage, an email-code sign-in reaches the pending page;
- with setup open, it reaches the admin as admin;
- a second account is pending until promoted;
- after sign-out the old token answers 401 at `GET /v1/auth/session`;
- prod's `/admin` shows the Lumen sign-in page.

## PX2 — your account and organization

- Profile (Payload's `account` view replaced), Security activity,
  Organization and Notifications pages.
- The *Account* nav group.
- `/lumen/profile` and `/lumen/notifications` handlers.
- The console's framework-free models (profile, preferences, security events)
  are moved to a small shared module both can read, or copied with their
  tests.

**Done when**, on stage:
- the display name and a notification toggle change from the admin and read
  back through the API;
- the organization and security events render.

## PX3 — billing and plan

- The Billing & plan page: summary, entitlements, invoices, plans.
- `/lumen/billing/{checkout,portal,change,cancel,reconcile}`, with redirects
  to the provider and back.
- The provider's return lands on the page, which reconciles once.

**Done when**, on stage:
- the page shows the current plan and invoices;
- *Manage plan* reaches the provider's portal, and *Upgrade* reaches checkout;
  the provider's own pages are not driven further.

## PX4 — the front door

- `/` → `/admin` on the CMS.
- The console Worker becomes path-preserving `308` redirects to the CMS, and
  its UI and its tests are removed.
- `intent.yaml` `stage.url` / `prod.url` → the CMS.
- `POLAR_SUCCESS_URL` → the CMS billing page.
- `cloudflare-domain` depends on the CMS.
- Branding: the title, logo and icon.

**Done when:**
- on stage and prod, the console URL, its old paths and its OAuth callback
  path land in the CMS;
- the admin's title reads *Lumen Payload*.

## PX5 — the record

- `ai/context/operations.md` (how to sign in, open setup, grant access, where
  the account pages are).
- The CMS's docs, the console's tombstone README, AGENTS.md.
- This epic's status file.

**Done when** the status file reads shipped.

## Sequencing note

PX1 changes who can reach the admin, so it lands alone and is verified before
anything builds on it. PX2 and PX3 only add pages. PX4 is the only step a user
of the old console notices, and it waits until the admin has everything the
console showed. The LMS repository (`multi-tenant-saas-2`) ports the result
afterwards, in its own epic.
