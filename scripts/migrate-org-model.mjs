/**
 * Migrate org tree to the bank-style model:
 *   HQ → Oversight → Campus → Account (COUNCIL)
 *
 * 1) Collapse STREAM nodes: reparent children under the stream's campus parent,
 *    then deactivate (do not delete) the stream.
 * 2) Split funded leaf campuses: keep campus, create Operating account child,
 *    move direct transactions + campus-leader role onto the account.
 *
 * Usage:
 *   node scripts/migrate-org-model.mjs           # dry-run (default)
 *   node scripts/migrate-org-model.mjs --apply   # write changes
 */
import 'dotenv/config';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function money(v) {
  return Number(v ?? 0);
}

async function approvedBalance(organisationId) {
  const grouped = await prisma.transaction.groupBy({
    by: ['type', 'status'],
    where: { organisationId },
    _sum: { amountInBase: true, amount: true },
  });
  let income = 0;
  let expense = 0;
  for (const g of grouped) {
    if (g.status !== 'APPROVED') continue;
    const amt = money(g._sum.amountInBase ?? g._sum.amount);
    if (g.type === 'INCOME') income += amt;
    else expense += amt;
  }
  return Math.round((income - expense) * 100) / 100;
}

async function collapseStreams(log) {
  const streams = await prisma.organisation.findMany({
    where: { level: 'STREAM' },
    select: {
      id: true,
      name: true,
      parentId: true,
      isActive: true,
      parent: { select: { id: true, name: true, level: true } },
      children: { select: { id: true, name: true, level: true } },
      userRoles: { select: { id: true, role: true, userId: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: { name: 'asc' },
  });

  log.streams = [];

  for (const stream of streams) {
    const campus = stream.parent;
    if (!campus || campus.level !== 'CAMPUS') {
      log.streams.push({
        stream: stream.name,
        error: `Parent is not a Campus (got ${campus?.level || 'none'}) — skipped`,
      });
      continue;
    }

    if (stream._count.transactions > 0) {
      log.streams.push({
        stream: stream.name,
        error: `Stream has ${stream._count.transactions} direct transactions — skipped`,
      });
      continue;
    }

    const entry = {
      stream: stream.name,
      campus: campus.name,
      reparented: stream.children.map((c) => c.name),
      rolesCleared: stream.userRoles.length,
      deactivate: true,
    };
    log.streams.push(entry);

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      for (const child of stream.children) {
        await tx.organisation.update({
          where: { id: child.id },
          data: { parentId: campus.id },
        });
      }

      for (const role of stream.userRoles) {
        await tx.userRole.delete({ where: { id: role.id } });
        const remaining = await tx.userRole.count({ where: { userId: role.userId } });
        if (remaining === 0) {
          await tx.user.update({
            where: { id: role.userId },
            data: { activeUserRoleId: null, activeRole: null, organisationId: null },
          });
        }
      }

      await tx.organisation.update({
        where: { id: stream.id },
        data: { isActive: false, name: `${stream.name} (closed stream)` },
      });
    });
  }
}

async function splitFundedCampuses(log) {
  const campuses = await prisma.organisation.findMany({
    where: { level: 'CAMPUS', isActive: true },
    select: {
      id: true,
      name: true,
      parentId: true,
      children: { select: { id: true } },
      userRoles: {
        select: { id: true, role: true, userId: true, user: { select: { name: true, email: true } } },
      },
      _count: { select: { transactions: true } },
    },
    orderBy: { name: 'asc' },
  });

  log.fundedCampuses = [];

  for (const campus of campuses) {
    // Only leaf campuses with direct money need splitting.
    if (campus.children.length > 0) continue;

    const balance = await approvedBalance(campus.id);
    const txCount = campus._count.transactions;
    if (txCount === 0 && balance === 0) continue;

    const accountName = `${campus.name} Operating`;
    const leaderRole = campus.userRoles.find((r) => r.role === 'CAMPUS_LEADER');
    const adminRoles = campus.userRoles.filter((r) => r.role === 'CAMPUS_ADMIN');

    const entry = {
      campus: campus.name,
      balance,
      transactionsMoved: txCount,
      newAccount: accountName,
      holderFrom: leaderRole?.user?.name || leaderRole?.user?.email || null,
      managersKeptOnCampus: adminRoles.map((r) => r.user?.name || r.user?.email),
    };
    log.fundedCampuses.push(entry);

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      const account = await tx.organisation.create({
        data: {
          id: crypto.randomUUID(),
          name: accountName,
          level: 'COUNCIL',
          parentId: campus.id,
          accountType: 'OPERATING',
          updatedAt: new Date(),
        },
      });

      await tx.transaction.updateMany({
        where: { organisationId: campus.id },
        data: { organisationId: account.id },
      });

      if (leaderRole) {
        await tx.userRole.update({
          where: { id: leaderRole.id },
          data: {
            role: 'COUNCIL_LEADER',
            organisationId: account.id,
          },
        });

        const user = await tx.user.findUnique({ where: { id: leaderRole.userId } });
        if (user?.activeUserRoleId === leaderRole.id) {
          await tx.user.update({
            where: { id: leaderRole.userId },
            data: {
              activeRole: 'COUNCIL_LEADER',
              organisationId: account.id,
            },
          });
        } else if (user?.organisationId === campus.id) {
          await tx.user.update({
            where: { id: leaderRole.userId },
            data: { organisationId: account.id },
          });
        }
      }
    });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');

  const log = { mode: APPLY ? 'APPLY' : 'DRY_RUN', streams: [], fundedCampuses: [] };

  console.log(`\n=== migrate-org-model (${log.mode}) ===\n`);

  await collapseStreams(log);
  await splitFundedCampuses(log);

  console.log(JSON.stringify(log, null, 2));
  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write changes.\n');
  } else {
    console.log('\nApplied.\n');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
