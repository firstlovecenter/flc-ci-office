import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { sendSms } from '@/lib/sms';
import { generateCorrectionNotificationSms, generateDepartmentTransferSms } from '@/lib/sms-templates';
import crypto from 'crypto';

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const body = await request.json();
        const { newAmount, reason, newDepartmentId } = body;
        const originalTransactionId = params.id;

        // Determine if this is a department change, amount change, or both
        const isDepartmentChange = newDepartmentId && newDepartmentId !== '';
        const isAmountChange = newAmount !== undefined && newAmount !== null;

        // Only admins can create corrections
        const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return NextResponse.json(
                { error: 'Only admins can create transaction corrections' },
                { status: 403 }
            );
        }

        // Get the original transaction
        const originalTransaction = await prisma.transaction.findUnique({
            where: { id: originalTransactionId },
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
                        phone: true,
                    },
                },
                currency: true,
            },
        });

        if (!originalTransaction) {
            return NextResponse.json(
                { error: 'Original transaction not found' },
                { status: 404 }
            );
        }

        // Validate the new department if provided
        let newDepartment = null;
        if (isDepartmentChange) {
            newDepartment = await prisma.department.findUnique({
                where: { id: newDepartmentId },
                select: { id: true, name: true, level: true },
            });
            if (!newDepartment) {
                return NextResponse.json(
                    { error: 'New department not found' },
                    { status: 404 }
                );
            }
        }

        // Calculate the difference
        const originalAmount = Number(originalTransaction.amount);
        const newAmountValue = isAmountChange ? Number(newAmount) : originalAmount;
        const correctionAmount = newAmountValue - originalAmount;

        if (correctionAmount === 0 && !isDepartmentChange) {
            return NextResponse.json(
                { error: 'No changes detected. Please change the amount or department.' },
                { status: 400 }
            );
        }

        const targetDepartmentId = isDepartmentChange ? newDepartmentId : originalTransaction.departmentId;
        const targetDepartment = isDepartmentChange ? newDepartment! : originalTransaction.department;

        // Amount-only correction (no department change)
        // Handle department change: reverse from old department, create in new department
        if (isDepartmentChange) {
            // Step 1: Reverse the original transaction in the old department
            const reverseType = originalTransaction.type === 'INCOME' ? 'EXPENSE' : 'INCOME';
            const reverseDescription = `DEPT TRANSFER: Reversed - moved to ${targetDepartment.name}. ${reason || 'Department correction'} - Ref: ${originalTransaction.id.substring(0, 8)}`;

            let reverseAmountInBase = originalAmount;
            if (originalTransaction.currencyId && originalTransaction.exchangeRate) {
                reverseAmountInBase = originalAmount * Number(originalTransaction.exchangeRate);
            }

            const reversalTransaction = await prisma.transaction.create({
                data: {
                    id: crypto.randomUUID(),
                    type: reverseType,
                    amount: originalAmount,
                    amountInBase: reverseAmountInBase,
                    description: reverseDescription,
                    departmentId: originalTransaction.departmentId,
                    userId: session.user.id,
                    currencyId: originalTransaction.currencyId,
                    exchangeRate: originalTransaction.exchangeRate,
                    status: 'APPROVED',
                    approvedBy: session.user.id,
                    approvedAt: new Date(),
                    locked: false,
                    weekNumber: originalTransaction.weekNumber,
                    year: originalTransaction.year,
                    updatedAt: new Date(),
                },
                include: {
                    department: { select: { id: true, name: true, level: true } },
                    currency: true,
                },
            });

            // Step 2: Create the transaction in the new department with the (possibly new) amount
            const newDescription = `DEPT TRANSFER: From ${originalTransaction.department.name}. ${reason || 'Department correction'} - Ref: ${originalTransaction.id.substring(0, 8)}`;

            let newAmountInBase = newAmountValue;
            if (originalTransaction.currencyId && originalTransaction.exchangeRate) {
                newAmountInBase = newAmountValue * Number(originalTransaction.exchangeRate);
            }

            const newTransaction = await prisma.transaction.create({
                data: {
                    id: crypto.randomUUID(),
                    type: originalTransaction.type,
                    amount: newAmountValue,
                    amountInBase: newAmountInBase,
                    description: newDescription,
                    departmentId: targetDepartmentId,
                    userId: session.user.id,
                    currencyId: originalTransaction.currencyId,
                    exchangeRate: originalTransaction.exchangeRate,
                    status: 'APPROVED',
                    approvedBy: session.user.id,
                    approvedAt: new Date(),
                    locked: false,
                    weekNumber: originalTransaction.weekNumber,
                    year: originalTransaction.year,
                    updatedAt: new Date(),
                },
                include: {
                    department: { select: { id: true, name: true, level: true } },
                    currency: true,
                },
            });

            // Audit logs for both transactions
            await createAuditLog({
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Transaction',
                entityId: reversalTransaction.id,
                description: `Reversed transaction ${originalTransaction.id} for department transfer to ${targetDepartment.name}`,
                beforeData: null,
                afterData: reversalTransaction as any,
                metadata: {
                    originalTransactionId: originalTransaction.id,
                    transferTo: targetDepartmentId,
                    reason,
                },
                severity: 'HIGH',
            });

            await createAuditLog({
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Transaction',
                entityId: newTransaction.id,
                description: `Created transfer transaction from ${originalTransaction.department.name} to ${targetDepartment.name}`,
                beforeData: null,
                afterData: newTransaction as any,
                metadata: {
                    originalTransactionId: originalTransaction.id,
                    transferFrom: originalTransaction.departmentId,
                    originalAmount,
                    newAmount: newAmountValue,
                    reason,
                },
                severity: 'HIGH',
            });

            // Send SMS to old department leader
            try {
                const oldLeaderRole = originalTransaction.department.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                    originalTransaction.department.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                    originalTransaction.department.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                    originalTransaction.department.level === 'STREAM' ? 'STREAM_LEADER' :
                    'COUNCIL_LEADER';

                const oldLeaders = await prisma.userRole.findMany({
                    where: { role: oldLeaderRole, departmentId: originalTransaction.departmentId },
                    include: { user: { select: { phone: true, name: true, archived: true } } },
                });

                const oldDeptTransactions = await prisma.transaction.findMany({
                    where: { departmentId: originalTransaction.departmentId, status: 'APPROVED' },
                    select: { type: true, amountInBase: true, amount: true },
                });
                const oldBalance = oldDeptTransactions.reduce((sum, tx) => {
                    const txAmount = Number(tx.amountInBase || tx.amount);
                    return sum + (tx.type === 'INCOME' ? txAmount : -txAmount);
                }, 0);

                const currencySymbol = originalTransaction.currency?.symbol || '$';
                for (const lr of oldLeaders.filter(ur => ur.user.phone && !ur.user.archived)) {
                    const sms = generateDepartmentTransferSms({
                        transactionType: originalTransaction.type.toLowerCase(),
                        currency: currencySymbol,
                        amount: formatNumber(originalAmount),
                        fromDepartment: originalTransaction.department.name,
                        toDepartment: targetDepartment.name,
                        reason: reason || 'Department correction',
                        balance: formatNumber(oldBalance),
                    });
                    await sendSms({ to: lr.user.phone!, message: sms }).catch(() => {});
                }
            } catch (e) { /* Don't fail on SMS */ }

            // Send SMS to new department leader
            try {
                const newLeaderRole = targetDepartment.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                    targetDepartment.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                    targetDepartment.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                    targetDepartment.level === 'STREAM' ? 'STREAM_LEADER' :
                    'COUNCIL_LEADER';

                const newLeaders = await prisma.userRole.findMany({
                    where: { role: newLeaderRole, departmentId: targetDepartmentId },
                    include: { user: { select: { phone: true, name: true, archived: true } } },
                });

                const newDeptTransactions = await prisma.transaction.findMany({
                    where: { departmentId: targetDepartmentId, status: 'APPROVED' },
                    select: { type: true, amountInBase: true, amount: true },
                });
                const newBalance = newDeptTransactions.reduce((sum, tx) => {
                    const txAmount = Number(tx.amountInBase || tx.amount);
                    return sum + (tx.type === 'INCOME' ? txAmount : -txAmount);
                }, 0);

                const currencySymbol = originalTransaction.currency?.symbol || '$';
                for (const lr of newLeaders.filter(ur => ur.user.phone && !ur.user.archived)) {
                    const sms = generateDepartmentTransferSms({
                        transactionType: originalTransaction.type.toLowerCase(),
                        currency: currencySymbol,
                        amount: formatNumber(newAmountValue),
                        fromDepartment: originalTransaction.department.name,
                        toDepartment: targetDepartment.name,
                        reason: reason || 'Department correction',
                        balance: formatNumber(newBalance),
                    });
                    await sendSms({ to: lr.user.phone!, message: sms }).catch(() => {});
                }
            } catch (e) { /* Don't fail on SMS */ }

            return NextResponse.json({
                success: true,
                originalTransaction,
                reversalTransaction,
                newTransaction,
                message: `Transaction transferred from ${originalTransaction.department.name} to ${targetDepartment.name}${correctionAmount !== 0 ? ` with amount adjusted to ${formatCurrency(newAmountValue, originalTransaction.currency?.code, originalTransaction.currency?.symbol)}` : ''}.`,
            });
        }
        // For EXPENSE: if new < original, we need to CREDIT back (INCOME)
        // For EXPENSE: if new > original, we need to DEBIT more (EXPENSE)
        // For INCOME: if new < original, we need to DEBIT back (EXPENSE)
        // For INCOME: if new > original, we need to CREDIT more (INCOME)
        
        // Simply: same type if correction is positive, opposite if negative
        const correctionType = correctionAmount > 0 
            ? originalTransaction.type 
            : (originalTransaction.type === 'EXPENSE' ? 'INCOME' : 'EXPENSE');
        const absoluteCorrectionAmount = Math.abs(correctionAmount);

        // Calculate correction amount in base currency
        let correctionAmountInBase = absoluteCorrectionAmount;
        if (originalTransaction.currencyId && originalTransaction.exchangeRate) {
            correctionAmountInBase = absoluteCorrectionAmount * Number(originalTransaction.exchangeRate);
        }

        // Create the correction transaction
        const correctionDescription = `CORRECTION: ${reason || 'Amount adjustment'} (Original: ${formatCurrency(originalAmount, originalTransaction.currency?.code, originalTransaction.currency?.symbol)} → New: ${formatCurrency(newAmount, originalTransaction.currency?.code, originalTransaction.currency?.symbol)}) - Ref: ${originalTransaction.id.substring(0, 8)}`;

        const correctionTransaction = await prisma.transaction.create({
            data: {
                id: crypto.randomUUID(),
                type: correctionType,
                amount: absoluteCorrectionAmount,
                amountInBase: correctionAmountInBase,
                description: correctionDescription,
                departmentId: originalTransaction.departmentId,
                userId: session.user.id, // Correction created by admin
                currencyId: originalTransaction.currencyId,
                exchangeRate: originalTransaction.exchangeRate,
                status: 'APPROVED', // Auto-approve corrections
                approvedBy: session.user.id,
                approvedAt: new Date(),
                locked: false,
                weekNumber: originalTransaction.weekNumber,
                year: originalTransaction.year,
                updatedAt: new Date(),
            },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
                currency: true,
            },
        });

        // Create audit log
        await createAuditLog({
            userId: session.user.id,
            actionType: 'CREATE',
            entityType: 'Transaction',
            entityId: correctionTransaction.id,
            description: `Created correction transaction for ${originalTransaction.id}`,
            beforeData: null,
            afterData: correctionTransaction as any,
            metadata: {
                originalTransactionId: originalTransaction.id,
                originalAmount,
                newAmount,
                correctionAmount,
                reason,
            },
            severity: 'HIGH',
        });

        // Send SMS notification to the department leader
        try {
            // Find the department leader based on department level
            const leaderRole = originalTransaction.department.level === 'DENOMINATION' ? 'DENOMINATION_LEADER' :
                              originalTransaction.department.level === 'OVERSIGHT' ? 'OVERSIGHT_LEADER' :
                              originalTransaction.department.level === 'CAMPUS' ? 'CAMPUS_LEADER' :
                              originalTransaction.department.level === 'STREAM' ? 'STREAM_LEADER' :
                              'COUNCIL_LEADER';

            const departmentLeader = await prisma.user.findFirst({
                where: {
                    userRoles: {
                        some: {
                            role: leaderRole,
                            departmentId: originalTransaction.departmentId,
                        },
                    },
                },
                select: {
                    phone: true,
                },
            });

            if (departmentLeader?.phone) {
                // Calculate department balance after this correction
                const departmentTransactions = await prisma.transaction.findMany({
                    where: {
                        departmentId: originalTransaction.departmentId,
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

                const currencySymbol = originalTransaction.currency?.symbol || '$';
                const smsMessage = await generateCorrectionNotificationSms({
                    transactionType: originalTransaction.type.toLowerCase(),
                    departmentName: originalTransaction.department.name,
                    currency: currencySymbol,
                    originalAmount: formatNumber(originalAmount),
                    newAmount: formatNumber(newAmount),
                    correctionType: correctionType === 'INCOME' ? 'Credit' : 'Debit',
                    adjustmentAmount: formatNumber(absoluteCorrectionAmount),
                    reason: reason || 'Amount adjustment',
                    balance: formatNumber(balance),
                });
                
                await sendSms({
                    to: departmentLeader.phone,
                    message: smsMessage
                });
            }
        } catch (smsError) {
            // Don't fail the request if SMS fails
        }

        return NextResponse.json({
            success: true,
            originalTransaction,
            correctionTransaction,
            message: `Correction transaction created successfully. ${correctionType === 'INCOME' ? 'Credited' : 'Debited'} ${formatCurrency(absoluteCorrectionAmount, originalTransaction.currency?.code, originalTransaction.currency?.symbol)}`,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create correction transaction' },
            { status: 500 }
        );
    }
}
