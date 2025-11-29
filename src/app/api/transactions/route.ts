import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentWeek, formatNumber } from '@/lib/utils';
import { sendSms } from '@/lib/sms';
import { generatePendingApprovalRequestSms, generateCreditAlertSms } from '@/lib/sms-templates';
import { getDescendantDepartmentIds, hasDepartmentAccess } from '@/lib/departments';
import { getUserBaseCurrency, convertToUserBaseCurrency } from '@/lib/currency-conversion';

export const revalidate = 15; // Revalidate every 15 seconds

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

        if (session.user.role !== 'SUPERADMIN') {
            if (!session.user.departmentId) {
                return new NextResponse('Forbidden', { status: 403 });
            }

            // Get all allowed department IDs
            const allowedIds = await getDescendantDepartmentIds(session.user.departmentId);

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

        // Add converted amount to each transaction
        const transactionsWithConversion = transactions.map(tx => {
            const currencyId = tx.currencyId || userBaseCurrency.id;
            const convertedAmount = convertToUserBaseCurrency(
                Number(tx.amount),
                currencyId,
                userBaseCurrency.id,
                exchangeRates
            );
            
            return {
                ...tx,
                amountInBase: convertedAmount,
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
        const { type, amount, description, departmentId, files, currencyId, exchangeRate } = body;
        const { weekNumber, year } = getCurrentWeek();

        // Validate that the user can create transaction for this department
        const canAccess = await hasDepartmentAccess(session.user, departmentId);
        if (!canAccess) {
            return new NextResponse('Unauthorized', { status: 403 });
        }

        // Validate base currency is set for national and below departments
        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            select: { level: true, id: true, name: true, parent: { select: { id: true, level: true, parent: { select: { id: true, level: true, parent: { select: { id: true, level: true } } } } } } }
        });

        if (department) {
            const nationalRoles = ['NATIONAL_ADMIN', 'NATIONAL_LEADER'];
            const regionalRoles = ['REGIONAL_ADMIN', 'REGIONAL_LEADER', 'CAMPUS_ADMIN', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER', 'STREAM_ADMIN', 'COUNCIL_ADMIN'];
            const requiresBaseCurrency = nationalRoles.includes(session.user.role) || regionalRoles.includes(session.user.role);

            if (requiresBaseCurrency) {
                // Find the national department
                let nationalDept = department;
                while (nationalDept && nationalDept.level !== 'NATIONAL') {
                    nationalDept = nationalDept.parent as typeof nationalDept;
                }

                if (nationalDept && nationalDept.level === 'NATIONAL') {
                    // Check if base currency is set for this national department
                    const deptBaseCurrency = await prisma.departmentBaseCurrency.findUnique({
                        where: { departmentId: nationalDept.id },
                    });

                    if (!deptBaseCurrency) {
                        return NextResponse.json(
                            { error: `Base currency must be set for ${nationalDept.name || 'your national department'} before transactions can be recorded. Please contact your National Admin to set the base currency.` },
                            { status: 400 }
                        );
                    }
                }
            }
        }

        // Calculate amount in base currency if using a different currency
        let amountInBase = amount; // Default to the original amount
        if (currencyId && exchangeRate) {
            amountInBase = amount * exchangeRate;
        }

        // Determine if this is a leader role (requires approval) or admin (auto-approved)
        const leaderRoles = ['GLOBAL_LEADER', 'INTERNATIONAL_LEADER', 'NATIONAL_LEADER', 'REGIONAL_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
        const isLeader = leaderRoles.includes(session.user.role);
        
        // Leaders can only create expense requests, not income
        if (isLeader && type === 'INCOME') {
            return new NextResponse('Leaders cannot record income. Please contact an admin.', { status: 403 });
        }

        const transaction = await prisma.transaction.create({
            data: {
                type,
                amount,
                currencyId: currencyId || null,
                exchangeRate: exchangeRate || null,
                amountInBase: amountInBase,
                description,
                departmentId,
                userId: session.user.id,
                weekNumber,
                year,
                locked: false,
                status: isLeader ? 'PENDING' : 'APPROVED',
                approvedBy: isLeader ? null : session.user.id,
                approvedAt: isLeader ? null : new Date(),
                files: {
                    create: files?.map((f: any) => ({
                        fileName: f.name,
                        fileUrl: f.url,
                        fileMime: f.mime,
                        uploadedBy: session.user.id,
                    })) || [],
                },
            },
            include: {
                department: true,
                currency: true,
            },
        });

        // Create Audit Log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Transaction',
                entityId: transaction.id,
                afterData: transaction as any,
            },
        });

        // Send SMS to campus admins if this is a pending transaction (created by leader)
        if (isLeader && transaction.status === 'PENDING') {
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
                                name: true,
                                archived: true,
                            },
                        },
                    },
                });

                // Filter to active users with phone numbers and extract unique users
                const campusAdmins = campusAdminRoles
                    .filter(ur => ur.user.phone && !ur.user.archived)
                    .map(ur => ({ phone: ur.user.phone!, name: ur.user.name }))
                    .filter((admin, index, self) => 
                        index === self.findIndex(a => a.phone === admin.phone)
                    );

                // Send SMS to all campus admins
                if (campusAdmins.length > 0) {
                    const currencySymbol = transaction.currency?.symbol || '$';
                    const smsMessage = await generatePendingApprovalRequestSms({
                        userName: session.user.name || 'A user',
                        transactionType: type.toLowerCase(),
                        currency: currencySymbol,
                        amount: formatNumber(amount),
                        description: description,
                    });
                    
                    for (const admin of campusAdmins) {
                        if (admin.phone) {
                            try {
                                await sendSms({
                                    to: admin.phone,
                                    message: smsMessage
                                });
                                console.log(`SMS sent to campus admin: ${admin.name} (${admin.phone})`);
                            } catch (err) {
                                console.error(`Failed to send SMS to ${admin.name}:`, err);
                            }
                        }
                    }
                } else {
                    console.warn('No campus admins found for department hierarchy:', departmentHierarchy);
                }
            } catch (smsError) {
                console.error('Failed to send SMS to campus admin:', smsError);
                // Don't fail the request if SMS fails
            }
        }

        // Send CREDIT ALERT to department leaders when admin creates income transaction
        if (!isLeader && type === 'INCOME' && transaction.status === 'APPROVED') {
            try {
                // Find the department leader based on department level
                const leaderRole = transaction.department.level === 'GLOBAL' ? 'GLOBAL_LEADER' :
                                  transaction.department.level === 'INTERNATIONAL' ? 'INTERNATIONAL_LEADER' :
                                  transaction.department.level === 'NATIONAL' ? 'NATIONAL_LEADER' :
                                  transaction.department.level === 'REGIONAL' ? 'REGIONAL_LEADER' :
                                  transaction.department.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                                  transaction.department.level === 'STREAM' ? 'STREAM_LEADER' :
                                  'COUNCIL_LEADER';

                const departmentLeaderRoles = await prisma.userRole.findMany({
                    where: {
                        role: leaderRole,
                        departmentId: transaction.departmentId,
                    },
                    include: {
                        user: {
                            select: {
                                phone: true,
                                name: true,
                                archived: true,
                            },
                        },
                    },
                });

                // Filter active users with phone numbers
                const leaders = departmentLeaderRoles
                    .filter(ur => ur.user.phone && !ur.user.archived)
                    .map(ur => ({ phone: ur.user.phone!, name: ur.user.name }));

                if (leaders.length > 0) {
                    // Calculate department balance after this income
                    const departmentTransactions = await prisma.transaction.findMany({
                        where: {
                            departmentId: transaction.departmentId,
                            status: 'APPROVED',
                        },
                        select: {
                            type: true,
                            amountInBase: true,
                            amount: true,
                        },
                    });

                    const balance = departmentTransactions.reduce((sum, tx) => {
                        const txAmount = Number(tx.amountInBase || tx.amount);
                        return sum + (tx.type === 'INCOME' ? txAmount : -txAmount);
                    }, 0);

                    const currencySymbol = transaction.currency?.symbol || '$';
                    
                    // Generate credit alert message using template
                    const smsMessage = await generateCreditAlertSms({
                        currency: currencySymbol,
                        amount: formatNumber(amount),
                        departmentName: transaction.department.name,
                        description: description.substring(0, 40) + (description.length > 40 ? '...' : ''),
                        balance: formatNumber(balance),
                    });
                    
                    for (const leader of leaders) {
                        if (leader.phone) {
                            try {
                                await sendSms({
                                    to: leader.phone,
                                    message: smsMessage
                                });
                                console.log(`Credit alert SMS sent to leader: ${leader.name} (${leader.phone})`);
                            } catch (err) {
                                console.error(`Failed to send credit alert SMS to ${leader.name}:`, err);
                            }
                        }
                    }
                } else {
                    console.warn('No department leaders found for credit alert notification');
                }
            } catch (smsError) {
                console.error('Failed to send credit alert SMS to leader:', smsError);
                // Don't fail the request if SMS fails
            }
        }

        return NextResponse.json(transaction);
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
        const { id, type, amount, description, departmentId, currencyId, exchangeRate, files } = body;

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
        if (transaction.locked) { // Check DB flag
            return new NextResponse('Transaction is locked', { status: 400 });
        }

        // We also need to check if the week is logically locked, even if DB flag isn't set yet
        // (e.g. if the cron job hasn't run, or just logic based)
        // Importing isWeekLocked locally to avoid circular deps if any (none here)
        const { isWeekLocked } = await import('@/lib/utils');
        if (isWeekLocked(transaction.weekNumber, transaction.year)) {
            return new NextResponse('Week is locked', { status: 400 });
        }

        // Calculate amount in base currency if using a different currency
        let amountInBase = amount; // Default to the original amount
        if (currencyId && exchangeRate) {
            amountInBase = amount * exchangeRate;
        }

        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: {
                type,
                amount,
                description,
                departmentId,
                currencyId: currencyId || null,
                exchangeRate: exchangeRate || null,
                amountInBase: amountInBase,
                files: files && files.length > 0 ? {
                    create: files.map((f: any) => ({
                        fileName: f.name,
                        fileUrl: f.url,
                        fileMime: f.mime,
                        uploadedBy: session.user.id,
                    })),
                } : undefined,
            },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
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
            return new NextResponse('Transaction is locked', { status: 400 });
        }

        const { isWeekLocked } = await import('@/lib/utils');
        if (isWeekLocked(transaction.weekNumber, transaction.year)) {
            return new NextResponse('Week is locked', { status: 400 });
        }

        await prisma.transaction.delete({
            where: { id },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
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
        const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
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
            },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
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
