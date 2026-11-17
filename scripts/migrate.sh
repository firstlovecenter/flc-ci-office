#!/usr/bin/env bash
# Run prisma migrate deploy against production.
# Requires RUN_MIGRATIONS=1 (or VERCEL_ENV=production).
# Uses DATABASE_URL from .env if not already in the environment.
#
# DATABASE_URL_UNPOOLED is set to the pooled URL so migrate-on-deploy.mjs
# does not derive the direct (unpooled) Neon endpoint, which is unreachable
# from outside AWS us-east-1.
set -euo pipefail

if [ -f .env ]; then
  DB_URL=$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
  export DATABASE_URL="${DATABASE_URL:-$DB_URL}"
fi

# Point the "direct" slot at the pooled URL — the unpooled endpoint is not
# reachable from a local machine (only from within Cloudflare/Vercel infra).
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
export RUN_MIGRATIONS=1
node scripts/migrate-on-deploy.mjs
