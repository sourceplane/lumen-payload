# Epic: lumen-payload-console (PX)

**Opening lumen-payload today shows Lumen's console (organizations, projects,
usage, settings), and Payload sits beside it at its own URL with its own
accounts. This epic makes Payload the console: the product URL opens the
Payload admin, a Lumen account signs you in with no second password, and the
Lumen pages the product actually serves in Solo mode (your account, your
organization, billing and plan, notifications, security activity) become pages
inside the Payload admin. The idea that makes it small enough: Payload's
custom auth strategy delegates sign-in to Lumen's identity plane through
`api-edge`, server to server, so the Lumen session never reaches browser
JavaScript; and Payload's custom admin views render Lumen's account surface
inside the admin, calling the same API the console calls today.**

This follows the recommendation of the CMS research (orun-cloud
`ai/proposals/cms-landscape-comparison-2026-10-24.md` §9.3 and §9.5): Payload
generates its own admin, so `web-console-next` is not reused, and identity is
delegated through a custom strategy. It also corrects a decision of
`lumen-payload-cms`, which put Payload *beside* the console (its decision 1);
the CMS, its schema and its media stay exactly as that epic built them.

## Status

| Field | Value |
|-------|-------|
| Status | Shipped (2026-10-28) |
| Cluster | **PX** (PX0–PX5) |
| Owner(s) | `apps/cms` (the console now) · `apps/identity-worker` (its OAuth return allowlist) · `apps/web-console-next` (retired to a redirect) · `packages/db` (one migration) |
| Builds on | `lumen-payload-cms` (PC0–PC5) and Solo mode (`specs/profiles/solo-m0.md`) |
| Changes | The CMS gains Lumen sign-in and the account pages; the Lumen console's URL redirects to the CMS. api-edge and every bounded-context worker are unchanged. |
| Decisions locked | (1) The **Payload admin is the console**; the Lumen console UI is retired to a redirect. (2) **Lumen identity is the only sign-in**: Payload's local strategy is off. (3) The CMS calls `api-edge` **server to server**; the Lumen session lives only in an httpOnly cookie on the CMS host. (4) **Roles stay Payload's**: a new account is *pending* until an admin grants editor or admin, and the first admin still needs the owner's setup token. (5) Only the **Solo-mode surface** moves; what Solo mode hides at the edge stays hidden. |
| Gate | PX1 is the first visible change: `/admin` asks for a Lumen sign-in on stage and prod. PX4 is the one users notice: the product URL opens Payload. |
| Shipped as | sourceplane/lumen-payload#21 (PX0), #22 (PX1), #23 (PX2), #24 (PX3), #25 (PX4) and the PX5 record; see `IMPLEMENTATION-STATUS.md` |

## Read order

1. `design.md` — sign-in, the strategy and the session, roles, the pages, the front door, security, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| PX0 — the spec | this doc set | merged to `main` |
| PX1 — Lumen sign-in | the `lumen` auth strategy, the sign-in page (email code, GitHub, Google), the session cookie, account mapping and pending accounts (migration `206_cms_lumen_identity`), sign-out | on stage, an email-code sign-in lands in the admin as *pending*; with setup opened it lands as admin; sign-out revokes the Lumen session |
| PX2 — your account and organization | Profile, Security activity, Organization and Notifications as admin pages | on stage, a signed-in user edits their display name and notification settings from the admin and reads their organization and security events |
| PX3 — billing and plan | Billing & plan in the admin: summary, entitlements, invoices, change plan, the provider's portal | on stage, the page shows the plan and opens checkout and the portal |
| PX4 — the front door | the Lumen console URL redirects to the CMS; the CMS root opens the admin; product URLs, OAuth return and billing return point at the CMS; branding | opening `lumen-payload-web-console-next-<env>` lands in the Payload admin on stage and prod |
| PX5 — the record | operations guide, component docs, AGENTS.md, status | the status file reads shipped |
