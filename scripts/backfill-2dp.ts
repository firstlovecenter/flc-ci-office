/**
 * One-time backfill: round every Transaction.amount and Transaction.amountInBase
 * with more than 2 decimal places to exactly 2 decimal places (ROUND_HALF_UP).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-2dp.ts          # dry run, prints diff
 *   npx tsx --env-file=.env scripts/backfill-2dp.ts --apply  # actually writes
 *
 * Safe to re-run: rows already at <=2dp are skipped.
 *
 * The exchangeRate column is NOT touched — exchange rates are not money and
 * legitimately use more precision (e.g. 14.5825 GHS per USD).
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const apply = process.argv.includes('--apply');

function fractionDigits(d: Prisma.Decimal | null | undefined): number {
    if (d === null || d === undefined) return 0;
    const s = d.toFixed();
    const i = s.indexOf('.');
    return i === -1 ? 0 : s.length - i - 1;
}

(async () => {
    console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (no writes) ===\nRe-run with --apply to commit changes.\n');

    const txs = await prisma.transaction.findMany({
        select: { id: true, amount: true, amountInBase: true },
    });

    interface Diff {
        id: string;
        amountBefore?: string;
        amountAfter?: string;
        amountInBaseBefore?: string;
        amountInBaseAfter?: string;
    }

    const diffs: Diff[] = [];

    for (const t of txs) {
        const aDigits = fractionDigits(t.amount);
        const bDigits = fractionDigits(t.amountInBase);
        if (aDigits <= 2 && bDigits <= 2) continue;

        const diff: Diff = { id: t.id };

        if (aDigits > 2) {
            const rounded = t.amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            diff.amountBefore = t.amount.toFixed();
            diff.amountAfter = rounded.toFixed();
        }
        if (bDigits > 2 && t.amountInBase) {
            const rounded = t.amountInBase.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            diff.amountInBaseBefore = t.amountInBase.toFixed();
            diff.amountInBaseAfter = rounded.toFixed();
        }

        diffs.push(diff);
    }

    if (diffs.length === 0) {
        console.log('No rows to update — every Transaction is already <= 2dp.');
        await prisma.$disconnect();
        return;
    }

    console.log(`${diffs.length} row(s) need updating:\n`);
    for (const d of diffs) {
        console.log(`  ${d.id.slice(0, 8)}`);
        if (d.amountBefore) console.log(`    amount       ${d.amountBefore}  →  ${d.amountAfter}`);
        if (d.amountInBaseBefore) console.log(`    amountInBase ${d.amountInBaseBefore}  →  ${d.amountInBaseAfter}`);
    }

    if (!apply) {
        console.log(`\n(${diffs.length} row(s) would be updated. Run again with --apply to commit.)`);
        await prisma.$disconnect();
        return;
    }

    // Apply in a single transaction so it's atomic.
    await prisma.$transaction(
        diffs.map((d) => {
            const data: { amount?: string; amountInBase?: string } = {};
            if (d.amountAfter) data.amount = d.amountAfter;
            if (d.amountInBaseAfter) data.amountInBase = d.amountInBaseAfter;
            return prisma.transaction.update({ where: { id: d.id }, data });
        }),
    );

    console.log(`\n✓ Updated ${diffs.length} row(s).`);
    await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
