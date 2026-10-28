# cloudflare-domain

Manages the Cloudflare zone and attaches custom domains to environment-specific Worker services (cms)

Manages DNS records and Worker routes/custom domains on the product zone for lumen-payload, per environment (`stage`, `prod`; `dev` is
verify-only and provisions nothing).

## Depends on

- **cms** — the product and its console (Payload CMS on Workers), which the parked domain would serve

## Depended on by

- (none)
