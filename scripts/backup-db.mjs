/**
 * Full JSON backup of the financially-significant tables.
 *
 * Written before any structural refactor. Read-only: performs SELECTs and
 * writes a file, never modifies the database.
 *
 *   node scripts/backup-db.mjs [--out <dir>]
 *
 * Captures every Transaction field verbatim (amounts as strings, so Decimal
 * precision survives the JSON round-trip), plus the Organisation tree, role
 * assignments and receipt metadata — everything the bank-account split touches.
 *
 * User password hashes are deliberately excluded: a restore can reset them, and
 * a plaintext file of bcrypt hashes is a liability.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const outFlag = process.argv.indexOf('--out');
const OUT_DIR = outFlag !== -1 ? process.argv[outFlag + 1] : path.resolve(process.cwd(), '..', 'flc-accounts-db-backups');

/** Decimal and Date -> string, so nothing loses precision through JSON. */
const serialise = (v) => JSON.parse(JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && typeof val.toFixed === 'function' && !(val instanceof Date)) return val.toFixed();
    return val;
}));

async function main() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    console.log('Reading tables…');
    const [transactions, organisations, userRoles, users, files, currencies, baseCurrencies] = await Promise.all([
        prisma.transaction.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.organisation.findMany({ orderBy: { createdAt: 'asc' } }),
        prisma.userRole.findMany(),
        prisma.user.findMany({ omit: { password: true } }),
        prisma.file.findMany(),
        prisma.currency.findMany(),
        prisma.organisationBaseCurrency.findMany(),
    ]);

    const payload = {
        meta: {
            capturedAt: new Date().toISOString(),
            database: (process.env.DATABASE_URL || '').replace(/:[^:@]*@/, ':***@'),
            note: 'Pre-refactor backup. User password hashes intentionally omitted.',
        },
        counts: {
            transactions: transactions.length,
            organisations: organisations.length,
            userRoles: userRoles.length,
            users: users.length,
            files: files.length,
            currencies: currencies.length,
            baseCurrencies: baseCurrencies.length,
        },
        data: {
            transactions: serialise(transactions),
            organisations: serialise(organisations),
            userRoles: serialise(userRoles),
            users: serialise(users),
            files: serialise(files),
            currencies: serialise(currencies),
            baseCurrencies: serialise(baseCurrencies),
        },
    };

    // Integrity anchors: if a restore reproduces these, the money is intact.
    const approved = transactions.filter(t => t.status === 'APPROVED');
    const sum = (type) => approved
        .filter(t => t.type === type)
        .reduce((n, t) => n + Number(t.amountInBase ?? t.amount), 0);
    const income = sum('INCOME');
    const expense = sum('EXPENSE');

    payload.integrity = {
        approvedIncome: income.toFixed(2),
        approvedExpense: expense.toFixed(2),
        netBalance: (income - expense).toFixed(2),
        transactionChecksum: crypto.createHash('sha256')
            .update(JSON.stringify(payload.data.transactions)).digest('hex'),
    };

    mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, `flc-accounts-backup-${stamp}.json`);
    writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`\nWrote ${file}`);
    console.table(payload.counts);
    console.log('Integrity anchors:');
    console.log(`  approved income  : ${payload.integrity.approvedIncome}`);
    console.log(`  approved expense : ${payload.integrity.approvedExpense}`);
    console.log(`  net balance      : ${payload.integrity.netBalance}`);
    console.log(`  tx checksum      : ${payload.integrity.transactionChecksum}`);

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
