/**
 * Applies pending Prisma migrations as part of a production build.
 *
 *   node scripts/migrate-on-deploy.mjs   (run by `npm run build`)
 *
 * Only on Vercel production builds (VERCEL_ENV=production). Preview builds of
 * unmerged branches share the same database URL, and must never change it;
 * local builds skip too. Set RUN_MIGRATIONS=1 to force a run elsewhere.
 *
 * Runs `prisma migrate deploy` and nothing else: it only applies migrations not
 * yet recorded in _prisma_migrations, never resets, never drops, never
 * generates new ones. A failure fails the build, so code that needs a column is
 * never served without it.
 *
 * Migrations use Neon's direct (unpooled) connection when one is available —
 * Prisma's migration lock does not work reliably through the pooler.
 */
import { execFileSync } from 'child_process';

const isProductionBuild = process.env.VERCEL_ENV === 'production';
if (!isProductionBuild && process.env.RUN_MIGRATIONS !== '1') {
    console.log(`[migrate] Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'}).`);
    process.exit(0);
}

const pooled = process.env.DATABASE_URL;
const direct =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DIRECT_URL ||
    // Neon convention: the pooled host is the direct host plus "-pooler".
    (pooled ? pooled.replace('-pooler.', '.') : undefined);

if (!direct) {
    console.error('[migrate] DATABASE_URL is not set; cannot apply migrations.');
    process.exit(1);
}

console.log('[migrate] Applying pending migrations (prisma migrate deploy)…');
try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: direct },
    });
} catch {
    console.error('[migrate] Migration failed — stopping the build so the old deployment stays live.');
    process.exit(1);
}
console.log('[migrate] Migrations up to date.');
