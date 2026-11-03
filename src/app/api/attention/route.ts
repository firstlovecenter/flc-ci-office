import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDescendantOrganisationIds } from '@/lib/organisations';
import { getOverdueUnreceiptedApprovals, RECEIPT_ENFORCEMENT_START_DATE } from '@/lib/receipt-compliance';

export const dynamic = 'force-dynamic';

/** A request waiting this long is "holding up a church". */
const STALE_MS = 48 * 60 * 60 * 1000;
/** Receipts are due 24h after approval (see receipt-compliance). */
const RECEIPT_GRACE_MS = 24 * 60 * 60 * 1000;

const ADMIN_ROLES = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];

/**
 * What needs someone's attention right now, scoped to the viewer — the
 * dashboard's attention board. Every count here links to a filtered list, so
 * each one is computed with the same scope that list uses.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const role = (session.user.role || '').toUpperCase();
        const roles = (Array.isArray(session.user.roles) ? session.user.roles : []).map(r => String(r).toUpperCase());
        const isSuperAdmin = role === 'SUPERADMIN';
        const isAdmin = ADMIN_ROLES.includes(role);
        const isCampusAdmin = role === 'CAMPUS_ADMIN' || roles.includes('CAMPUS_ADMIN');
        const orgId = session.user.activeUserRole?.organisationId || session.user.organisationId;
        const now = Date.now();

        // null = everything (super admin / HQ manager), [] = nothing in scope.
        let scope: string[] | null = null;
        if (!isSuperAdmin && role !== 'DENOMINATION_ADMIN') {
            scope = orgId ? await getDescendantOrganisationIds(orgId) : [];
        }
        const inScope = scope ? { organisationId: { in: scope } } : {};

        const [stalePending, pending, overdueInScope, ownOverdue, publicRequests, accounts] = await Promise.all([
            isAdmin ? prisma.transaction.count({
                where: { ...inScope, status: 'PENDING', type: 'EXPENSE', createdAt: { lt: new Date(now - STALE_MS) }, NOT: { description: { startsWith: 'CORRECTION:' } } },
            }) : Promise.resolve(0),
            isAdmin ? prisma.transaction.count({
                where: { ...inScope, status: 'PENDING', NOT: { description: { startsWith: 'CORRECTION:' } } },
            }) : Promise.resolve(0),
            isAdmin ? prisma.transaction.count({
                where: {
                    ...inScope, type: 'EXPENSE', status: 'APPROVED', isCharge: false, receiptWaived: false,
                    approvedAt: { gte: RECEIPT_ENFORCEMENT_START_DATE, lte: new Date(now - RECEIPT_GRACE_MS) },
                    files: { none: {} },
                },
            }) : Promise.resolve(0),
            isAdmin ? Promise.resolve([]) : getOverdueUnreceiptedApprovals(session.user.id),
            isSuperAdmin
                ? prisma.publicExpenseRequest.count({ where: { status: 'PENDING' } })
                : isCampusAdmin && orgId
                    ? prisma.publicExpenseRequest.count({ where: { status: 'PENDING', campusOrganisationId: orgId } })
                    : Promise.resolve(0),
            isAdmin ? prisma.organisation.findMany({
                where: { level: 'COUNCIL', isActive: true, ...(scope ? { id: { in: scope } } : {}) },
                select: { id: true },
            }) : Promise.resolve([]),
        ]);

        // Accounts whose approved withdrawals exceed approved deposits.
        let overdrawn = 0;
        if (accounts.length) {
            const sums = await prisma.transaction.groupBy({
                by: ['organisationId', 'type'],
                where: { status: 'APPROVED', organisationId: { in: accounts.map(a => a.id) } },
                _sum: { amount: true },
            });
            const balance = new Map<string, number>();
            for (const row of sums) {
                const v = Number(row._sum.amount ?? 0) * (row.type === 'INCOME' ? 1 : -1);
                balance.set(row.organisationId, (balance.get(row.organisationId) ?? 0) + v);
            }
            overdrawn = [...balance.values()].filter(b => b < 0).length;
        }

        return NextResponse.json({
            isAdmin,
            stalePending,
            pending,
            overdueReceipts: isAdmin ? overdueInScope : ownOverdue.length,
            publicRequests,
            overdrawnAccounts: overdrawn,
        }, { headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' } });
    } catch (error) {
        console.error('[Attention] GET error:', error);
        return NextResponse.json({ error: 'Failed to load attention items' }, { status: 500 });
    }
}
