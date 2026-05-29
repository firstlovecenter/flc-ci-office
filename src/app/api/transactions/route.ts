import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
import { getCurrentWeek, getWeekFromDate, formatNumber } from '@/lib/utils';
import { sendSms } from '@/lib/sms';
import { generatePendingApprovalRequestSms, generateCreditAlertSms, generateDebitAlertSms } from '@/lib/sms-templates';
import { getDescendantDepartmentIds, hasDepartmentAccess } from '@/lib/departments';
import { getUserBaseCurrency, convertToUserBaseCurrency } from '@/lib/currency-conversion';
import { formatTimeInExpenseWindowTimeZone, getExpenseWindowStatus } from '@/lib/expense-window';
import { toDecimal, gt, isPositive, moneyToString, toMoney2dp } from '@/lib/money';
import { getDepartmentApprovedBalance } from '@/lib/balance';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const exactDepartment = searchParams.get('exactDepartment') === 'true';
    const status = searchParams.get('status');

    try {
        const whereClause: any = {};

        // Determine which department to use for filtering
        // For PENDING status queries (approvals page), use ALL user roles to show all pending transactions
        // For other queries, use the activeUserRole's department for context-specific filtering
        let filterDepartmentId = session.user.departmentId;
        let allDepartmentIds: string[] = [];
        
        if (status === 'PENDING' && session.user.role !== 'SUPERADMIN') {
            // For approvals, aggregate all departments from all user roles
            const userRoles = await prisma.userRole.findMany({
                where: { 
                    userId: session.user.id,
                },
                select: { departmentId: true },
            });
            
            // Get descendants for each role's department
            for (const role of userRoles) {
                if (role.departmentId) {
                    const descendants = await getDescendantDepartmentIds(role.departmentId);
                    allDepartmentIds.push(...descendants);
                }
            }
            
            // Also include user's base department
            if (filterDepartmentId) {
                const baseDescendants = await getDescendantDepartmentIds(filterDepartmentId);
                allDepartmentIds.push(...baseDescendants);
            }
            
            // Remove duplicates
            allDepartmentIds = [...new Set(allDepartmentIds)];
        } else if (session.user.activeUserRole?.departmentId) {
            // For non-pending queries, use active role's department from session
            filterDepartmentId = session.user.activeUserRole.departmentId;
        }

        if (session.user.role !== 'SUPERADMIN') {
            if (!filterDepartmentId && allDepartmentIds.length === 0) {
                return new NextResponse('Forbidden', { status: 403 });
            }

            // Use aggregated departments for pending queries, otherwise use standard filtering
            const allowedIds = allDepartmentIds.length > 0 
                ? allDepartmentIds 
                : (filterDepartmentId ? await getDescendantDepartmentIds(filterDepartmentId) : []);

            if (departmentId) {
                // If specific department requested, verify access
                if (!allowedIds.includes(departmentId)) {
                    return new NextResponse('Forbidden', { status: 403 });
                }
                // If exactDepartment is true, only get transactions from that specific department
                if (exactDepartment) {
                    whereClause.departmentId = departmentId;
                } else {
                    // Otherwise, get transactions from the department and all its descendants
                    const descendantIds = await getDescendantDepartmentIds(departmentId);
                    whereClause.departmentId = { in: descendantIds };
                }
            } else {
                // Otherwise, return transactions from all allowed departments
                whereClause.departmentId = { in: allowedIds };
            }
        } else if (departmentId) {
            // Superadmin can specify exact or hierarchical filtering
            if (exactDepartment) {
                whereClause.departmentId = departmentId;
            } else {
                const descendantIds = await getDescendantDepartmentIds(departmentId);
                whereClause.departmentId = { in: descendantIds };
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
            include: {
                department: {
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
        const { type, amount, description, departmentId, currencyId, exchangeRate, date } = body;
        
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

        // Validate that the user can create transaction for this department
        const canAccess = await hasDepartmentAccess(session.user, departmentId);
        if (!canAccess) {
            return new NextResponse('Unauthorized', { status: 403 });
        }

        // Determine if this is a leader role (time-restricted) or admin
        const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
        const isLeader = leaderRoles.includes(session.user.role);

        // Server-side time validation for expense requests - only for leaders
        // Admins can make requests anytime
        if (type === 'EXPENSE' && isLeader) {
            const expenseWindow = getExpenseWindowStatus();

            if (!expenseWindow.isOpen) {
                return NextResponse.json(
                    {
                        error: `Expense requests can only be made between ${expenseWindow.timeRange}. Actual time is ${formatTimeInExpenseWindowTimeZone(expenseWindow.now)}`,
                    },
                    { status: 400 }
                );
            }
        }

        // Validate base currency is set for oversight and below departments
        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            select: { level: true, id: true, name: true, parent: { select: { id: true, level: true, parent: { select: { id: true, level: true, parent: { select: { id: true, level: true } } } } } } }
        });

        if (department) {
            const oversightRoles = ['OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER', 'CAMPUS_ADMIN', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER', 'STREAM_ADMIN', 'COUNCIL_ADMIN'];
            const requiresBaseCurrency = oversightRoles.includes(session.user.role);

            if (requiresBaseCurrency) {
                // Find the oversight department
                let oversightDept = department;
                while (oversightDept && oversightDept.level !== 'OVERSIGHT') {
                    oversightDept = oversightDept.parent as typeof oversightDept;
                }

                if (oversightDept && oversightDept.level === 'OVERSIGHT') {
                    // Check if base currency is set for this oversight department
                    const deptBaseCurrency = await prisma.departmentBaseCurrency.findUnique({
                        where: { departmentId: oversightDept.id },
                    });

                    if (!deptBaseCurrency) {
                        return NextResponse.json(
                            { error: `Base currency must be set for ${oversightDept.name || 'your oversight department'} before transactions can be recorded. Please contact your Oversight Admin to set the base currency.` },
                            { status: 400 }
                        );
                    }
                }
            }
        }

        // Calculate amount in base currency using Decimal arithmetic to avoid float drift.
        // Persist clamped to 2dp so balances always render to cents.
        const amountDec = toDecimal(amount);
        const amountInBaseDec = currencyId && exchangeRate
            ? amountDec.mul(toDecimal(exchangeRate))
            : amountDec;
        const amountToPersist = toMoney2dp(amountDec);
        const amountInBase = toMoney2dp(amountInBaseDec);

        // All roles except SUPERADMIN require approval for EXPENSE transactions
        // All INCOME transactions are auto-approved (no approval needed)
        const isSuperAdmin = session.user.role === 'SUPERADMIN';
        const isIncomeTransaction = type === 'INCOME';
        const needsApproval = !isSuperAdmin && !isIncomeTransaction;
        
        // Leaders can only create expense requests, not income
        if (isLeader && type === 'INCOME') {
            return new NextResponse('Leaders cannot record income. Please contact an admin.', { status: 403 });
        }

        // Server-side balance validation for expense requests.
        // Compares Decimal values end-to-end against the exact-department
        // approved balance. The request amount is converted to base currency
        // before comparing so foreign-currency requests are checked correctly.
        if (type === 'EXPENSE') {
            const deptBalance = await getDepartmentApprovedBalance(departmentId);

            if (!isPositive(deptBalance)) {
                return NextResponse.json(
                    { error: 'This church does not have a positive balance. Expense requests cannot be made for churches without a positive balance.' },
                    { status: 400 }
                );
            }

            if (gt(amountInBaseDec, deptBalance)) {
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
                currencyId: currencyId || null,
                exchangeRate: exchangeRate || null,
                amountInBase: amountInBase,
                description,
                departmentId,
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
            include: {
                department: true,
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
                // Get the department with its hierarchy
                const dept = await prisma.department.findUnique({
                    where: { id: transaction.departmentId },
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

                // Build array of department IDs in the hierarchy (from current up to campus level)
                const departmentHierarchy: string[] = [];
                if (dept) {
                    departmentHierarchy.push(dept.id);
                    let currentDept: any = dept.parent;
                    while (currentDept) {
                        departmentHierarchy.push(currentDept.id);
                        if (currentDept.level === 'CAMPUS') break; // Stop at campus level
                        currentDept = currentDept.parent;
                    }
                }

                // Find all users who have been assigned CAMPUS_ADMIN role for departments in the hierarchy
                const campusAdminRoles = await prisma.userRole.findMany({
                    where: {
                        role: 'CAMPUS_ADMIN',
                        departmentId: { in: departmentHierarchy },
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

        // Send CREDIT/DEBIT ALERT to department leaders when auto-approved transaction is created (SUPERADMIN only)
        if (transaction.status === 'APPROVED') {
            try {
                const alertType = type === 'INCOME' ? 'CREDIT' : 'DEBIT';
                console.log(`[SMS] Processing ${alertType} alert for ${type.toLowerCase()} transaction in ${transaction.department.name}`);
                
                // Find the department leader based on department level
                const leaderRole = transaction.department.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                                  transaction.department.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                                  transaction.department.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                                  transaction.department.level === 'STREAM' ? 'STREAM_LEADER' :
                                  'COUNCIL_LEADER';

                console.log(`[SMS] Looking for ${leaderRole} in department ${transaction.departmentId}`);

                // Get department leaders - this will find users with leader role even if they have other roles
                const departmentLeaderRoles = await prisma.userRole.findMany({
                    where: {
                        role: leaderRole,
                        departmentId: transaction.departmentId,
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
                const leaders = departmentLeaderRoles
                    .filter(ur => !ur.user.archived)
                    .reduce((acc: { phone: string | null; email: string; name: string | null }[], ur) => {
                        if (!acc.find(l => l.email === ur.user.email)) {
                            acc.push({ phone: ur.user.phone, email: ur.user.email, name: ur.user.name });
                        }
                        return acc;
                    }, []);

                console.log(`[SMS] Found ${leaders.length} leader(s) for ${alertType} alert`);

                if (leaders.length > 0) {
                    const balance = await getDepartmentApprovedBalance(transaction.departmentId);

                    const currencySymbol = transaction.currency?.symbol || '₵';
                    const descText = description || (type === 'INCOME' ? 'Income' : 'Expense');
                    const descShort = descText.substring(0, 40) + (descText.length > 40 ? '...' : '');
                    const amtStr = formatNumber(moneyToString(amount));
                    const balStr = formatNumber(moneyToString(balance));
                    const deptName = transaction.department.name;
                    
                    // Generate appropriate alert message based on transaction type
                    let smsMessage: string;
                    if (type === 'INCOME') {
                        smsMessage = await generateCreditAlertSms({
                            currency: currencySymbol,
                            amount: amtStr,
                            departmentName: deptName,
                            description: descShort,
                            balance: balStr,
                        });
                    } else {
                        smsMessage = await generateDebitAlertSms({
                            currency: currencySymbol,
                            amount: amtStr,
                            departmentName: deptName,
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
                            }
                        } catch (err) {
                            console.error(`[SMS] Error sending ${alertType} alert to leader:`, err);
                        }
                    }
                } else {
                    console.log(`[SMS] No leaders with phone numbers found for ${alertType} alert`);
                }
            } catch (smsError) {
                // Don't fail the request if SMS fails
                console.error('[SMS] Error in transaction alert block:', smsError);
            }
        }

        // Calculate new balance for the department (exact, in Decimal)
        let newBalance: string | null = null;
        let balanceCurrency: { code: string; symbol: string } | null = null;

        try {
            const balance = await getDepartmentApprovedBalance(transaction.departmentId);
            newBalance = moneyToString(balance);

            // Get currency from department's base currency
            const dept = await prisma.department.findUnique({
                where: { id: transaction.departmentId },
                include: { 
                    departmentBaseCurrency: {
                        include: { currency: true }
                    }
                },
            });
            if (dept?.departmentBaseCurrency?.currency) {
                balanceCurrency = {
                    code: dept.departmentBaseCurrency.currency.code,
                    symbol: dept.departmentBaseCurrency.currency.symbol,
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
        const { id, type, amount, description, departmentId, currencyId, exchangeRate } = body;

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
        const canAccess = await hasDepartmentAccess(session.user, transaction.departmentId);
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

        // Calculate amount in base currency using Decimal arithmetic to avoid float drift.
        // Persist clamped to 2dp so balances always render to cents.
        const amountDec = toDecimal(amount);
        const amountInBaseDec = currencyId && exchangeRate
            ? amountDec.mul(toDecimal(exchangeRate))
            : amountDec;
        const amountToPersist = toMoney2dp(amountDec);
        const amountInBase = toMoney2dp(amountInBaseDec);

        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: {
                type,
                amount: amountToPersist,
                description,
                departmentId,
                currencyId: currencyId || null,
                exchangeRate: exchangeRate || null,
                amountInBase: amountInBase,
                updatedAt: new Date(),
            },
            include: {
                department: true,
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
        const canAccess = await hasDepartmentAccess(session.user, transaction.departmentId);
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
                department: { select: { name: true } },
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
        const canAccess = await hasDepartmentAccess(session.user, transaction.departmentId);
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
            include: {
                department: true,
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
