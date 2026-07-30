import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
import { getCurrentWeek, getWeekFromDate, formatNumber } from '@/lib/utils';
import { sendSms } from '@/lib/sms';
import { generatePendingApprovalRequestSms, generateCreditAlertSms, generateDebitAlertSms, generateAdminTransactionAlertSms } from '@/lib/sms-templates';
import { getDescendantOrganisationIds, hasOrganisationAccess } from '@/lib/organisations';
import { getUserBaseCurrency, convertToUserBaseCurrency } from '@/lib/currency-conversion';
import { formatTimeInExpenseWindowTimeZone, getExpenseWindowStatus } from '@/lib/expense-window';
import { toDecimal, gt, isPositive, moneyToString, toMoney2dp } from '@/lib/money';
import { getOrganisationApprovedBalance } from '@/lib/balance';
import { getOverdueUnreceiptedApprovals } from '@/lib/receipt-compliance';
import {
    assertMoneyBearingOrganisation,
    canRecordDeposit,
    hasAccountBalance,
    isExpenseWindowExempt,
} from '@/lib/org-model';
import { getAppCurrency } from '@/lib/currency';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organisationId = searchParams.get('organisationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const exactOrganisation = searchParams.get('exactOrganisation') === 'true';
    const status = searchParams.get('status');

    try {
        const whereClause: any = {};

        // Determine which organisation to use for filtering
        // For PENDING status queries (approvals page), use ALL user roles to show all pending transactions
        // For other queries, use the activeUserRole's organisation for context-specific filtering
        let filterOrganisationId = session.user.organisationId;
        let allOrganisationIds: string[] = [];
        
        if (status === 'PENDING' && session.user.role !== 'SUPERADMIN') {
            // For approvals, aggregate all organisations from all user roles
            const userRoles = await prisma.userRole.findMany({
                where: { 
                    userId: session.user.id,
                },
                select: { organisationId: true },
            });
            
            // Get descendants for each role's organisation
            for (const role of userRoles) {
                if (role.organisationId) {
                    const descendants = await getDescendantOrganisationIds(role.organisationId);
                    allOrganisationIds.push(...descendants);
                }
            }
            
            // Also include user's base organisation
            if (filterOrganisationId) {
                const baseDescendants = await getDescendantOrganisationIds(filterOrganisationId);
                allOrganisationIds.push(...baseDescendants);
            }
            
            // Remove duplicates
            allOrganisationIds = [...new Set(allOrganisationIds)];
        } else if (session.user.activeUserRole?.organisationId) {
            // For non-pending queries, use active role's organisation from session
            filterOrganisationId = session.user.activeUserRole.organisationId;
        }

        if (session.user.role !== 'SUPERADMIN') {
            if (!filterOrganisationId && allOrganisationIds.length === 0) {
                return new NextResponse('Forbidden', { status: 403 });
            }

            // Use aggregated organisations for pending queries, otherwise use standard filtering
            const allowedIds = allOrganisationIds.length > 0 
                ? allOrganisationIds 
                : (filterOrganisationId ? await getDescendantOrganisationIds(filterOrganisationId) : []);

            if (organisationId) {
                // If specific organisation requested, verify access
                if (!allowedIds.includes(organisationId)) {
                    return new NextResponse('Forbidden', { status: 403 });
                }
                // If exactOrganisation is true, only get transactions from that specific organisation
                if (exactOrganisation) {
                    whereClause.organisationId = organisationId;
                } else {
                    // Otherwise, get transactions from the organisation and all its descendants
                    const descendantIds = await getDescendantOrganisationIds(organisationId);
                    whereClause.organisationId = { in: descendantIds };
                }
            } else {
                // Otherwise, return transactions from all allowed organisations
                whereClause.organisationId = { in: allowedIds };
            }
        } else if (organisationId) {
            // Superadmin can specify exact or hierarchical filtering
            if (exactOrganisation) {
                whereClause.organisationId = organisationId;
            } else {
                const descendantIds = await getDescendantOrganisationIds(organisationId);
                whereClause.organisationId = { in: descendantIds };
            }
        }

        // Add date filtering
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                whereClause.createdAt.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt.lte = end;
            }
        }

        // Add status filtering
        if (status) {
            whereClause.status = status;
        }

        const transactions = await prisma.transaction.findMany({
            where: whereClause,
            include: { organisation: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                currency: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        symbol: true,
                        isBase: true,
                    },
                },
                receiptWaivedByUser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                files: {
                    select: {
                        id: true,
                        fileName: true,
                        fileUrl: true,
                        fileMime: true,
                        fileSize: true,
                        uploadedAt: true,
                        uploadedBy: true,
                        uploader: { select: { id: true, name: true, email: true } },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 500, // Limit results for performance
        });

        // Get user's base currency and exchange rates
        const userBaseCurrency = await getUserBaseCurrency(session.user.id);
        
        if (!userBaseCurrency) {
            return NextResponse.json(transactions);
        }

        const exchangeRates = await prisma.exchangeRate.findMany({
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
        });

        // Add converted amount to each transaction. Compute in Decimal,
        // serialize to an exact string so the client receives full precision.
        const transactionsWithConversion = transactions.map(tx => {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            const convertedAmount = convertToUserBaseCurrency(
                tx.amount as any,
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            );

            return {
                ...tx,
                amountInBase: moneyToString(convertedAmount),
            };
        });

        return NextResponse.json(transactionsWithConversion);
    } catch (error) {
        return new NextResponse(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Error' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const { type, amount, description, organisationId, date } = body;
        
        // If a custom date is provided, compute week number from that date
        // Otherwise use current week
        let weekNumber: number;
        let year: number;
        let transactionDate: Date | undefined;
        if (date) {
            transactionDate = new Date(date);
            const weekInfo = getWeekFromDate(transactionDate);
            weekNumber = weekInfo.weekNumber;
            year = weekInfo.year;
        } else {
            const weekInfo = getCurrentWeek();
            weekNumber = weekInfo.weekNumber;
            year = weekInfo.year;
        }

        // Validate that the user can create transaction for this organisation
        const canAccess = await hasOrganisationAccess(session.user, organisationId);
        if (!canAccess) {
            return new NextResponse('Unauthorized', { status: 403 });
        }

        // Determine if this is a leader role (time-restricted) or admin
        const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
        const isLeader = leaderRoles.includes(session.user.role);

        // Money only on Accounts; load org early for account-type rules.
        const organisation = await prisma.organisation.findUnique({
            where: { id: organisationId },
            select: {
                level: true,
                id: true,
                name: true,
                accountType: true,
                parent: {
                    select: {
                        id: true,
                        level: true,
                        parent: {
                            select: {
                                id: true,
                                level: true,
                                parent: { select: { id: true, level: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!organisation) {
            return NextResponse.json({ error: 'Church not found' }, { status: 404 });
        }

        const moneyError = assertMoneyBearingOrganisation(organisation.level);
        if (moneyError) {
            return NextResponse.json({ error: moneyError }, { status: 400 });
        }

        if (type === 'INCOME' && !canRecordDeposit(organisation.accountType)) {
            return NextResponse.json(
                { error: 'Special project accounts do not accept deposits. Record withdrawals only.' },
                { status: 400 }
            );
        }

        // Leaders with an expense request approved on/after the receipt
        // enforcement start date that is more than 24 hours old and still has no
        // uploaded receipt are blocked from submitting new requests.
        if (isLeader) {
            const overdueApprovals = await getOverdueUnreceiptedApprovals(session.user.id);

            if (overdueApprovals.length > 0) {
                const list = overdueApprovals
                    .map((t) => `"${t.description}" (${moneyToString(toDecimal(t.amount))})`)
                    .join(', ');

                return NextResponse.json(
                    {
                        error: `You have ${overdueApprovals.length} approved expense request${overdueApprovals.length > 1 ? 's' : ''} older than 24 hours without an uploaded receipt: ${list}. Please upload the receipt(s) before making new requests.`,
                        overdueReceiptTransactionIds: overdueApprovals.map((t) => t.id),
                    },
                    { status: 400 }
                );
            }
        }

        // Expense time window: leaders only, and never for special projects.
        if (type === 'EXPENSE' && isLeader && !isExpenseWindowExempt(organisation.accountType)) {
            const expenseWindow = getExpenseWindowStatus();

            if (!expenseWindow.isOpen) {
                return NextResponse.json(
                    {
                        error: expenseWindow.isSunday
                            ? 'Withdrawal requests are not accepted on Sundays. Please try again Monday from 6:00 AM.'
                            : `Withdrawal requests can only be made between ${expenseWindow.timeRange}. Actual time is ${formatTimeInExpenseWindowTimeZone(expenseWindow.now)}`,
                    },
                    { status: 400 }
                );
            }
        }

        // App is GHS-only — amounts are already in Ghana Cedis.
        const ghs = await getAppCurrency();
        const amountDec = toDecimal(amount);
        const amountToPersist = toMoney2dp(amountDec);
        const amountInBase = amountToPersist;

        // All roles except SUPERADMIN require approval for EXPENSE transactions
        // All INCOME transactions are auto-approved (no approval needed)
        const isSuperAdmin = session.user.role === 'SUPERADMIN';
        const isIncomeTransaction = type === 'INCOME';
        const needsApproval = !isSuperAdmin && !isIncomeTransaction;
        
        // Account holders can only create withdrawal requests, not deposits
        if (isLeader && type === 'INCOME') {
            return new NextResponse('You cannot record deposits. Please contact a manager.', { status: 403 });
        }

        // Balance check for operating accounts only — special projects have no spendable balance.
        if (type === 'EXPENSE' && hasAccountBalance(organisation.accountType)) {
            const deptBalance = await getOrganisationApprovedBalance(organisationId);

            if (!isPositive(deptBalance)) {
                return NextResponse.json(
                    { error: 'This account does not have a positive balance. Withdrawal requests cannot be made without a positive balance.' },
                    { status: 400 }
                );
            }

            if (gt(amountDec, deptBalance)) {
                return NextResponse.json(
                    { error: `Insufficient balance. The available balance is ${moneyToString(deptBalance)}. You cannot request more than this amount.` },
                    { status: 400 }
                );
            }
        }

        const transaction = await prisma.transaction.create({
            data: {
                id: crypto.randomUUID(),
                type,
                amount: amountToPersist,
                currencyId: ghs.id,
                exchangeRate: null,
                amountInBase,
                description,
                organisationId,
                userId: session.user.id,
                weekNumber,
                year,
                locked: false,
                ...(transactionDate ? { createdAt: transactionDate } : {}),
                updatedAt: new Date(),
                status: needsApproval ? 'PENDING' : 'APPROVED',
                approvedBy: needsApproval ? null : session.user.id,
                approvedAt: needsApproval ? null : new Date(),
            },
            include: { organisation: true,
                currency: true,
            },
        });

        // Create Audit Log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Transaction',
                entityId: transaction.id,
                afterData: transaction as any,
            },
        });

        // Send SMS to campus admins if this is a pending transaction (created by leader or admin)
        if (transaction.status === 'PENDING') {
            try {
                // Get the organisation with its hierarchy
                const dept = await prisma.organisation.findUnique({
                    where: { id: transaction.organisationId },
                    include: {
                        parent: {
                            include: {
                                parent: {
                                    include: {
                                        parent: true
                                    }
                                }
                            }
                        }
                    }
                });

                // Build array of organisation IDs in the hierarchy (from current up to campus level)
                const organisationHierarchy: string[] = [];
                if (dept) {
                    organisationHierarchy.push(dept.id);
                    let currentOrg: any = dept.parent;
                    while (currentOrg) {
                        organisationHierarchy.push(currentOrg.id);
                        if (currentOrg.level === 'CAMPUS') break; // Stop at campus level
                        currentOrg = currentOrg.parent;
                    }
                }

                // Find all users who have been assigned CAMPUS_ADMIN role for organisations in the hierarchy
                const campusAdminRoles = await prisma.userRole.findMany({
                    where: {
                        role: 'CAMPUS_ADMIN',
                        organisationId: { in: organisationHierarchy },
                    },
                    include: {
                        user: {
                            select: {
                                phone: true,
                                email: true,
                                name: true,
                                archived: true,
                            },
                        },
                    },
                });

                // Filter to active users and extract unique users
                const campusAdmins = campusAdminRoles
                    .filter(ur => !ur.user.archived)
                    .reduce((acc: { phone: string | null; email: string; name: string | null }[], ur) => {
                        if (!acc.find(a => a.email === ur.user.email)) {
                            acc.push({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name });
                        }
                        return acc;
                    }, []);

                // Send SMS and email to all campus admins
                if (campusAdmins.length > 0) {
                    const currencySymbol = transaction.currency?.symbol || '$';
                    const smsMessage = await generatePendingApprovalRequestSms({
                        userName: session.user.name || 'A user',
                        transactionType: type.toLowerCase(),
                        currency: currencySymbol,
                        amount: formatNumber(amount),
                        description: description,
                    });
                    
                    console.log(`[SMS] Sending pending approval SMS to ${campusAdmins.length} campus admin(s)`);
                    
                    for (const admin of campusAdmins) {
                        try {
                            if (admin.phone) {
                                const sent = await sendSms({ to: admin.phone, message: smsMessage }).catch(() => false);
                                console.log(`[SMS] Sent to ${admin.phone}: ${sent ? 'SUCCESS' : 'FAILED'}`);
                            }
                        } catch (err) {
                            console.error(`[SMS] Error sending to ${admin.email}:`, err);
                        }
                    }
                } else {
                    console.log('[SMS] No campus admins with phone numbers found for approval notification');
                }
            } catch (smsError) {
                // Don't fail the request if SMS fails
                console.error('[SMS] Error in approval notification block:', smsError);
            }
        }

        // Send CREDIT/DEBIT ALERT to organisation leaders when auto-approved transaction is created (SUPERADMIN only)
        if (transaction.status === 'APPROVED') {
            try {
                const alertType = type === 'INCOME' ? 'CREDIT' : 'DEBIT';
                console.log(`[SMS] Processing ${alertType} alert for ${type.toLowerCase()} transaction in ${transaction.organisation.name}`);
                
                // Find the organisation leader based on organisation level
                const leaderRole = transaction.organisation.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                                  transaction.organisation.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                                  transaction.organisation.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                                  transaction.organisation.level === 'STREAM' ? 'STREAM_LEADER' :
                                  'COUNCIL_LEADER';

                console.log(`[SMS] Looking for ${leaderRole} in organisation ${transaction.organisationId}`);

                // Get organisation leaders - this will find users with leader role even if they have other roles
                const organisationLeaderRoles = await prisma.userRole.findMany({
                    where: {
                        role: leaderRole,
                        organisationId: transaction.organisationId,
                    },
                    include: {
                        user: {
                            select: {
                                phone: true,
                                email: true,
                                name: true,
                                archived: true,
                            },
                        },
                    },
                });

                // Filter active users, deduplicate by email
                const leaders = organisationLeaderRoles
                    .filter(ur => !ur.user.archived)
                    .reduce((acc: { phone: string | null; email: string; name: string | null }[], ur) => {
                        if (!acc.find(l => l.email === ur.user.email)) {
                            acc.push({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name });
                        }
                        return acc;
                    }, []);

                console.log(`[SMS] Found ${leaders.length} leader(s) for ${alertType} alert`);

                // Compute shared balance + formatted values once, reused for both the
                // account-owner alert and the acting-admin confirmation below.
                const balance = await getOrganisationApprovedBalance(transaction.organisationId);
                const currencySymbol = transaction.currency?.symbol || '₵';
                const descText = description || (type === 'INCOME' ? 'Income' : 'Expense');
                const descShort = descText.substring(0, 40) + (descText.length > 40 ? '...' : '');
                const amtStr = formatNumber(moneyToString(amount));
                const balStr = formatNumber(moneyToString(balance));
                const deptName = transaction.organisation.name;

                // Track phones already alerted so the admin doesn't get a duplicate
                // message when they are also the organisation leader.
                const notifiedPhones = new Set<string>();

                // 1) Alert the account owner (organisation leader) being credited/debited
                if (leaders.length > 0) {
                    // Generate appropriate alert message based on transaction type
                    let smsMessage: string;
                    if (type === 'INCOME') {
                        smsMessage = await generateCreditAlertSms({
                            currency: currencySymbol,
                            amount: amtStr,
                            organisationName: deptName,
                            description: descShort,
                            balance: balStr,
                        });
                    } else {
                        smsMessage = await generateDebitAlertSms({
                            currency: currencySymbol,
                            amount: amtStr,
                            organisationName: deptName,
                            description: descShort,
                            balance: balStr,
                        });
                    }

                    console.log(`[SMS] Sending ${alertType} alert to ${leaders.length} leader(s): ${smsMessage}`);

                    for (const leader of leaders) {
                        try {
                            if (leader.phone) {
                                const sent = await sendSms({ to: leader.phone, message: smsMessage }).catch(() => false);
                                console.log(`[SMS] ${alertType} alert to ${leader.phone}: ${sent ? 'SUCCESS' : 'FAILED'}`);
                                notifiedPhones.add(leader.phone);
                            }
                        } catch (err) {
                            console.error(`[SMS] Error sending ${alertType} alert to leader:`, err);
                        }
                    }
                } else {
                    console.log(`[SMS] No leaders with phone numbers found for ${alertType} alert`);
                }

                // 2) Alert the admin who performed the crediting/debiting (confirmation)
                try {
                    const actingAdmin = await prisma.user.findUnique({
                        where: { id: session.user.id },
                        select: { phone: true },
                    });

                    if (actingAdmin?.phone && !notifiedPhones.has(actingAdmin.phone)) {
                        const adminMessage = await generateAdminTransactionAlertSms({
                            transactionType: type,
                            currency: currencySymbol,
                            amount: amtStr,
                            organisationName: deptName,
                            description: descShort,
                            balance: balStr,
                        });
                        const sent = await sendSms({ to: actingAdmin.phone, message: adminMessage }).catch(() => false);
                        console.log(`[SMS] ${alertType} confirmation to admin ${actingAdmin.phone}: ${sent ? 'SUCCESS' : 'FAILED'}`);
                    } else if (actingAdmin?.phone) {
                        console.log(`[SMS] Admin ${actingAdmin.phone} already alerted as leader; skipping duplicate ${alertType} confirmation`);
                    } else {
                        console.log(`[SMS] Acting admin has no phone number; skipping ${alertType} confirmation`);
                    }
                } catch (adminSmsError) {
                    console.error(`[SMS] Error sending ${alertType} confirmation to admin:`, adminSmsError);
                }
            } catch (smsError) {
                // Don't fail the request if SMS fails
                console.error('[SMS] Error in transaction alert block:', smsError);
            }
        }

        // Calculate new balance for the organisation (exact, in Decimal)
        let newBalance: string | null = null;
        let balanceCurrency: { code: string; symbol: string } | null = null;

        try {
            const balance = await getOrganisationApprovedBalance(transaction.organisationId);
            newBalance = moneyToString(balance);

            // Get currency from organisation's base currency
            const dept = await prisma.organisation.findUnique({
                where: { id: transaction.organisationId },
                include: { 
                    organisationBaseCurrency: {
                        include: { currency: true }
                    }
                },
            });
            if (dept?.organisationBaseCurrency?.currency) {
                balanceCurrency = {
                    code: dept.organisationBaseCurrency.currency.code,
                    symbol: dept.organisationBaseCurrency.currency.symbol,
                };
            }
        } catch (balanceError) {
            console.error('[Balance] Error calculating new balance:', balanceError);
        }

        return NextResponse.json({
            ...transaction,
            newBalance,
            currency: balanceCurrency,
        });
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, type, amount, description, organisationId } = body;

        const transaction = await prisma.transaction.findUnique({
            where: { id },
        });

        if (!transaction) {
            return new NextResponse('Not Found', { status: 404 });
        }

        // Leaders cannot edit transactions at all
        const leaderRolesCheck = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
        if (leaderRolesCheck.includes(session.user.role)) {
            return new NextResponse('Leaders are not permitted to edit transactions', { status: 403 });
        }

        // Check permissions
        const canAccess = await hasOrganisationAccess(session.user, transaction.organisationId);
        if (!canAccess) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Check locking
        if (transaction.locked) { // Check DB flag
            if (session.user.role !== 'SUPERADMIN') {
                return new NextResponse('Transaction is locked', { status: 400 });
            }
        }

        // Check if the week is logically locked
        const { isWeekLocked } = await import('@/lib/utils');
        if (isWeekLocked(transaction.weekNumber, transaction.year)) {
            // Only oversight admin and above can edit past-week transactions
            const oversightAndAboveRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN'];
            if (!oversightAndAboveRoles.includes(session.user.role)) {
                return new NextResponse('Week is locked. Only Oversight Admin and above can edit past-week transactions.', { status: 400 });
            }
        }

        const ghs = await getAppCurrency();
        const amountToPersist = toMoney2dp(toDecimal(amount));

        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: {
                type,
                amount: amountToPersist,
                description,
                organisationId,
                currencyId: ghs.id,
                exchangeRate: null,
                amountInBase: amountToPersist,
                updatedAt: new Date(),
            },
            include: { organisation: true,
                currency: true,
            },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Transaction',
                entityId: transaction.id,
                beforeData: transaction as any,
                afterData: updatedTransaction as any,
            },
        });

        return NextResponse.json(updatedTransaction);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return new NextResponse('Missing ID', { status: 400 });
        }

        const transaction = await prisma.transaction.findUnique({
            where: { id },
        });

        if (!transaction) {
            return new NextResponse('Not Found', { status: 404 });
        }

        // Check permissions
        const canAccess = await hasOrganisationAccess(session.user, transaction.organisationId);
        if (!canAccess) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Check locking
        if (transaction.locked) {
            if (session.user.role !== 'SUPERADMIN') {
                return new NextResponse('Transaction is locked', { status: 400 });
            }
        }

        const { isWeekLocked: isWeekLockedFn } = await import('@/lib/utils');
        if (isWeekLockedFn(transaction.weekNumber, transaction.year)) {
            const oversightAndAboveRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN'];
            if (!oversightAndAboveRoles.includes(session.user.role)) {
                return new NextResponse('Week is locked. Only Oversight Admin and above can delete past-week transactions.', { status: 400 });
            }
        }

        await prisma.transaction.delete({
            where: { id },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'DELETE',
                entityType: 'Transaction',
                entityId: transaction.id,
                beforeData: transaction as any,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, action, rejectionReason } = body;

        if (!['approve', 'reject'].includes(action)) {
            return new NextResponse('Invalid action', { status: 400 });
        }

        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: {
                user: { select: { name: true, email: true } },
                organisation: { select: { name: true } },
                currency: { select: { code: true, symbol: true } },
            },
        });

        if (!transaction) {
            return new NextResponse('Not Found', { status: 404 });
        }

        // Only admins can approve/reject
        const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return new NextResponse('Only admins can approve/reject transactions', { status: 403 });
        }

        // Check permissions
        const canAccess = await hasOrganisationAccess(session.user, transaction.organisationId);
        if (!canAccess) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Check if already processed
        if (transaction.status !== 'PENDING') {
            return new NextResponse('Transaction already processed', { status: 400 });
        }

        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: {
                status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                approvedBy: action === 'approve' ? session.user.id : null,
                approvedAt: action === 'approve' ? new Date() : null,
                rejectedBy: action === 'reject' ? session.user.id : null,
                rejectedAt: action === 'reject' ? new Date() : null,
                rejectionReason: action === 'reject' ? rejectionReason : null,
                updatedAt: new Date(),
            },
            include: { organisation: true,
                currency: true,
            },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: action === 'approve' ? 'APPROVE' : 'REJECT',
                entityType: 'Transaction',
                entityId: transaction.id,
                beforeData: transaction as any,
                afterData: updatedTransaction as any,
            },
        });

        return NextResponse.json(updatedTransaction);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
