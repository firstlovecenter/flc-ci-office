/**
 * Golden snapshot of scope and balance answers — the verifier for the
 * bank-account split.
 *
 *   npm run snapshot:capture   # record current answers as the baseline
 *   npm run snapshot:verify    # recompute and assert nothing drifted
 *
 * Read-only. Performs SELECTs and writes/reads a baseline file.
 *
 * The critical design choice: entries are keyed by *business identity*
 * (name + level + parent name), never by row id or table shape. That is what
 * lets the same baseline validate the schema both before and after accounts
 * move out of the Organisation table — the question "what is Revival's
 * recursive balance?" has one right answer regardless of how it is stored.
 *
 * Balances are computed here in SQL rather than through app code, so the
 * baseline is an independent oracle rather than a recording of the very logic
 * being refactored.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MODE = process.argv[2] || 'capture';

/**
 * Written outside the repository by default.
 *
 * The baseline holds every account's balance and the organisation's net
 * position. The deploy flow makes this repo public, so a snapshot of the
 * financial position must not live inside it. It is also a migration-window
 * artifact rather than source — regenerate it, don't version it.
 *
 * Override with SCOPE_BASELINE_PATH if you need it elsewhere.
 */
const BASELINE = process.env.SCOPE_BASELINE_PATH
    ?? path.resolve(process.cwd(), '..', 'flc-accounts-db-backups', 'scope-baseline.json');

const money = (v) => Number(v ?? 0).toFixed(2);

async function computeSnapshot() {
    const { rows: orgs } = await pool.query(`
        SELECT o.id, o.name, o.level, o."parentId", o."isActive", o."accountType",
               p.name AS "parentName", p.level AS "parentLevel"
        FROM "Organisation" o
        LEFT JOIN "Organisation" p ON p.id = o."parentId"
        ORDER BY o.name
    `);

    // Recursive balance for a subtree, and exact balance for the row alone.
    const { rows: balances } = await pool.query(`
        WITH RECURSIVE tree AS (
            SELECT id AS root, id AS node FROM "Organisation"
            UNION ALL
            SELECT t.root, o.id FROM "Organisation" o JOIN tree t ON o."parentId" = t.node
        ),
        tx AS (
            SELECT "organisationId",
                   SUM(CASE WHEN type = 'INCOME'  THEN COALESCE("amountInBase", amount) ELSE 0 END) AS income,
                   SUM(CASE WHEN type = 'EXPENSE' THEN COALESCE("amountInBase", amount) ELSE 0 END) AS expense,
                   COUNT(*) AS n
            FROM "Transaction" WHERE status = 'APPROVED'
            GROUP BY "organisationId"
        )
        SELECT t.root AS id,
               COALESCE(SUM(tx.income), 0)  AS "recursiveIncome",
               COALESCE(SUM(tx.expense), 0) AS "recursiveExpense",
               COALESCE(SUM(tx.n), 0)       AS "recursiveCount"
        FROM tree t LEFT JOIN tx ON tx."organisationId" = t.node
        GROUP BY t.root
    `);

    const { rows: exact } = await pool.query(`
        SELECT "organisationId" AS id,
               SUM(CASE WHEN type = 'INCOME'  THEN COALESCE("amountInBase", amount) ELSE 0 END) AS income,
               SUM(CASE WHEN type = 'EXPENSE' THEN COALESCE("amountInBase", amount) ELSE 0 END) AS expense,
               COUNT(*) AS n
        FROM "Transaction" WHERE status = 'APPROVED'
        GROUP BY "organisationId"
    `);

    const { rows: descendants } = await pool.query(`
        WITH RECURSIVE tree AS (
            SELECT id AS root, id AS node FROM "Organisation"
            UNION ALL
            SELECT t.root, o.id FROM "Organisation" o JOIN tree t ON o."parentId" = t.node
        )
        SELECT t.root AS id, array_agg(o.name ORDER BY o.name) AS names
        FROM tree t JOIN "Organisation" o ON o.id = t.node
        GROUP BY t.root
    `);

    const recById = new Map(balances.map(r => [r.id, r]));
    const exactById = new Map(exact.map(r => [r.id, r]));
    const descById = new Map(descendants.map(r => [r.id, r.names]));

    const entries = {};
    for (const o of orgs) {
        // Business key: unique without depending on row ids surviving the split.
        const key = `${o.level}|${o.name}|${o.parentName ?? '-'}`;
        const rec = recById.get(o.id) ?? {};
        const ex = exactById.get(o.id) ?? {};
        entries[key] = {
            level: o.level,
            name: o.name,
            parent: o.parentName ?? null,
            isActive: o.isActive,
            accountType: o.accountType,
            exactIncome: money(ex.income),
            exactExpense: money(ex.expense),
            exactBalance: money(Number(ex.income ?? 0) - Number(ex.expense ?? 0)),
            exactTxCount: Number(ex.n ?? 0),
            recursiveIncome: money(rec.recursiveIncome),
            recursiveExpense: money(rec.recursiveExpense),
            recursiveBalance: money(Number(rec.recursiveIncome ?? 0) - Number(rec.recursiveExpense ?? 0)),
            recursiveTxCount: Number(rec.recursiveCount ?? 0),
            // Sorted names, so the scope set is comparable across schemas.
            subtree: (descById.get(o.id) ?? []).slice().sort(),
        };
    }

    const { rows: totals } = await pool.query(`
        SELECT COUNT(*)::int AS "txTotal",
               SUM(CASE WHEN status='APPROVED' AND type='INCOME'  THEN COALESCE("amountInBase", amount) ELSE 0 END) AS income,
               SUM(CASE WHEN status='APPROVED' AND type='EXPENSE' THEN COALESCE("amountInBase", amount) ELSE 0 END) AS expense
        FROM "Transaction"
    `);

    return {
        capturedAt: new Date().toISOString(),
        totals: {
            transactions: totals[0].txTotal,
            approvedIncome: money(totals[0].income),
            approvedExpense: money(totals[0].expense),
            netBalance: money(Number(totals[0].income) - Number(totals[0].expense)),
        },
        entries,
    };
}

function diff(baseline, current) {
    const problems = [];
    const bKeys = Object.keys(baseline.entries);
    const cKeys = Object.keys(current.entries);

    for (const k of bKeys) if (!cKeys.includes(k)) problems.push(`MISSING  ${k}`);
    for (const k of cKeys) if (!bKeys.includes(k)) problems.push(`ADDED    ${k}`);

    const compared = ['exactBalance', 'exactTxCount', 'recursiveBalance', 'recursiveTxCount', 'exactIncome', 'exactExpense'];
    for (const k of bKeys) {
        const b = baseline.entries[k], c = current.entries[k];
        if (!c) continue;
        for (const f of compared) {
            if (String(b[f]) !== String(c[f])) problems.push(`DRIFT    ${k}\n           ${f}: ${b[f]}  ->  ${c[f]}`);
        }
        const bs = b.subtree.join(','), cs = c.subtree.join(',');
        if (bs !== cs) problems.push(`SCOPE    ${k}\n           subtree changed\n           was: ${bs}\n           now: ${cs}`);
    }

    for (const f of ['transactions', 'approvedIncome', 'approvedExpense', 'netBalance']) {
        if (String(baseline.totals[f]) !== String(current.totals[f])) {
            problems.push(`TOTALS   ${f}: ${baseline.totals[f]}  ->  ${current.totals[f]}`);
        }
    }
    return problems;
}

async function main() {
    const current = await computeSnapshot();

    if (MODE === 'capture') {
        mkdirSync(path.dirname(BASELINE), { recursive: true });
        writeFileSync(BASELINE, JSON.stringify(current, null, 2), 'utf8');
        console.log(`Baseline written: ${BASELINE}`);
        console.log(`  organisations : ${Object.keys(current.entries).length}`);
        console.log(`  transactions  : ${current.totals.transactions}`);
        console.log(`  net balance   : ${current.totals.netBalance}`);
    } else {
        if (!existsSync(BASELINE)) { console.error('No baseline. Run: npm run snapshot:capture'); process.exit(1); }
        const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
        const problems = diff(baseline, current);
        if (!problems.length) {
            console.log(`✓ No drift. ${Object.keys(current.entries).length} organisations, net ${current.totals.netBalance}`);
        } else {
            console.error(`✗ ${problems.length} difference(s) vs baseline captured ${baseline.capturedAt}:\n`);
            for (const p of problems) console.error('  ' + p);
            process.exit(1);
        }
    }

    await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
