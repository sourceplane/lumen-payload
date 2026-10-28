# cms

Payload CMS on Cloudflare Workers: the admin panel at `/admin`, the REST API
at `/api/<collection>` and GraphQL at `/api/graphql`, over Postgres schema
`cms`, deployed beside the fleet as `lumen-payload-cms-<env>`.

| | stage | prod |
|---|---|---|
| URL | https://lumen-payload-cms-stage.nexo-7be.workers.dev | https://lumen-payload-cms-prod.nexo-7be.workers.dev |

## What it holds

- **users**: staff accounts (`admin`, `editor`). The first account is created
  through the setup gate and is an admin; admins create the rest.
- **pages** and **posts**: drafts, versions (25 per document), a Lexical
  rich-text body and a unique slug. Posts have an excerpt and a category.
- **categories**: name and slug.
- **media**: images (JPEG, PNG, GIF, WebP, AVIF) and PDFs up to 10 MiB, each
  with required alt text, stored in the CMS's R2 bucket and served back at
  `/api/media/file/<filename>`. No SVG: it can carry script on the admin's
  origin.

Published pages, posts and categories, and all media, are readable by anyone
through the API. Drafts, accounts and everything else need a staff session.
Staff upload media; only admins delete it.

## Depends on

- **cloudflare-hyperdrive-cms**: its database path (cache disabled) and its
  generated Payload secret.
- **cloudflare-r2-cms**: its media bucket.
- **db-migrate**: applies schema `cms` (migrations `200_cms_payload_core` and
  `205_cms_media`) before the CMS deploys.

Nothing in the fleet calls the CMS, and the CMS calls nothing in the fleet.

## Verified by

- **cms-tests** on every pull request that touches it.
- The deploy's smoke check on stage and prod: `/health` reports the database
  `ok`, and `/admin` answers 200.
