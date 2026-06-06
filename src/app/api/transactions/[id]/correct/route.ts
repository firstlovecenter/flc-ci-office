import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { toDecimal, moneyToString, toMoney2dp } from '@/lib/money';
import { getDepartmentApprovedBalance } from '@/lib/balance';
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
                        email: true,
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

        // Calculate the difference using Decimal arithmetic
        const originalAmountDec = toDecimal(originalTransaction.amount);
        const newAmountDec = isAmountChange ? toDecimal(newAmount) : originalAmountDec;
        const correctionAmountDec = newAmountDec.minus(originalAmountDec);
        const originalAmount = moneyToString(originalAmountDec);
        const newAmountValue = moneyToString(newAmountDec);

        if (correctionAmountDec.eq(0) && !isDepartmentChange) {
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
            const reverseDescription = `DEPT TRANSFER: Reversed - moved to ${targetDepartment.name}. Original: "${originalTransaction.description}". ${reason || 'Department correction'} - Ref: ${originalTransaction.id.substring(0, 8)}`;

            const reverseAmountInBaseDec = originalTransaction.currencyId && originalTransaction.exchangeRate
                ? originalAmountDec.mul(toDecimal(originalTransaction.exchangeRate))
                : originalAmountDec;

            const reversalTransaction = await prisma.transaction.create({
                data: {
                    id: crypto.randomUUID(),
                    type: reverseType,
                    amount: toMoney2dp(originalAmountDec),
                    amountInBase: toMoney2dp(reverseAmountInBaseDec),
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
            const newDescription = `DEPT TRANSFER: From ${originalTransaction.department.name}. Original: "${originalTransaction.description}". ${reason || 'Department correction'} - Ref: ${originalTransaction.id.substring(0, 8)}`;

            const newAmountInBaseDec = originalTransaction.currencyId && originalTransaction.exchangeRate
                ? newAmountDec.mul(toDecimal(originalTransaction.exchangeRate))
                : newAmountDec;

            const newTransaction = await prisma.transaction.create({
                data: {
                    id: crypto.randomUUID(),
                    type: originalTransaction.type,
                    amount: toMoney2dp(newAmountDec),
                    amountInBase: toMoney2dp(newAmountInBaseDec),
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

                const oldBalance = await getDepartmentApprovedBalance(originalTransaction.departmentId);

                const currencySymbol = originalTransaction.currency?.symbol || '$';
                for (const lr of oldLeaders.filter(ur => !ur.user.archived)) {
                    const sms = generateDepartmentTransferSms({
                        transactionType: originalTransaction.type.toLowerCase(),
                        currency: currencySymbol,
                        amount: formatNumber(originalAmount),
                        fromDepartment: originalTransaction.department.name,
                        toDepartment: targetDepartment.name,
                        reason: reason || 'Department correction',
                        balance: formatNumber(moneyToString(oldBalance)),
                    });
                    if (lr.user.phone) await sendSms({ to: lr.user.phone!, message: sms }).catch(() => {});
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

                const newBalance = await getDepartmentApprovedBalance(targetDepartmentId);

                const currencySymbol = originalTransaction.currency?.symbol || '$';
                for (const lr of newLeaders.filter(ur => !ur.user.archived)) {
                    const sms = generateDepartmentTransferSms({
                        transactionType: originalTransaction.type.toLowerCase(),
                        currency: currencySymbol,
                        amount: formatNumber(newAmountValue),
                        fromDepartment: originalTransaction.department.name,
                        toDepartment: targetDepartment.name,
                        reason: reason || 'Department correction',
                        balance: formatNumber(moneyToString(newBalance)),
                    });
                    if (lr.user.phone) await sendSms({ to: lr.user.phone!, message: sms }).catch(() => {});
                }
            } catch (e) { /* Don't fail on SMS */ }

            return NextResponse.json({
                success: true,
                originalTransaction,
                reversalTransaction,
                newTransaction,
                message: `Transaction transferred from ${originalTransaction.department.name} to ${targetDepartment.name}${!correctionAmountDec.eq(0) ? ` with amount adjusted to ${formatCurrency(newAmountValue, originalTransaction.currency?.code, originalTransaction.currency?.symbol)}` : ''}.`,
            });
        }
        // For EXPENSE: if new < original, we need to CREDIT back (INCOME)
        // For EXPENSE: if new > original, we need to DEBIT more (EXPENSE)
        // For INCOME: if new < original, we need to DEBIT back (EXPENSE)
        // For INCOME: if new > original, we need to CREDIT more (INCOME)
        
        // Simply: same type if correction is positive, opposite if negative
        const correctionType = correctionAmountDec.gt(0)
            ? originalTransaction.type
            : (originalTransaction.type === 'EXPENSE' ? 'INCOME' : 'EXPENSE');
        const absoluteCorrectionDec = correctionAmountDec.abs();
        const absoluteCorrectionAmount = moneyToString(absoluteCorrectionDec);

        // Calculate correction amount in base currency (Decimal arithmetic)
        const correctionAmountInBaseDec = originalTransaction.currencyId && originalTransaction.exchangeRate
            ? absoluteCorrectionDec.mul(toDecimal(originalTransaction.exchangeRate))
            : absoluteCorrectionDec;

        // Create the correction transaction
        const correctionDescription = `CORRECTION: ${reason || 'Amount adjustment'} (Original: ${formatCurrency(originalAmount, originalTransaction.currency?.code, originalTransaction.currency?.symbol)} → New: ${formatCurrency(newAmountValue, originalTransaction.currency?.code, originalTransaction.currency?.symbol)}) - Ref: ${originalTransaction.id.substring(0, 8)}`;

        const correctionTransaction = await prisma.transaction.create({
            data: {
                id: crypto.randomUUID(),
                type: correctionType,
                amount: toMoney2dp(absoluteCorrectionDec),
                amountInBase: toMoney2dp(correctionAmountInBaseDec),
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
                newAmount: newAmountValue,
                correctionAmount: moneyToString(correctionAmountDec),
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

            const departmentLeaders = await prisma.userRole.findMany({
                where: {
                    role: leaderRole,
                    departmentId: originalTransaction.departmentId,
                },
                include: {
                    user: {
                        select: { phone: true, name: true, archived: true },
                    },
                },
            });

            const activeLeaders = departmentLeaders.filter(ur => !ur.user.archived);

            if (activeLeaders.length > 0) {
                const balance = await getDepartmentApprovedBalance(originalTransaction.departmentId);

                const currencySymbol = originalTransaction.currency?.symbol || '$';
                const correctionParams = {
                    transactionType: originalTransaction.type.toLowerCase(),
                    departmentName: originalTransaction.department.name,
                    currency: currencySymbol,
                    originalAmount: formatNumber(originalAmount),
                    newAmount: formatNumber(newAmountValue),
                    correctionType: correctionType === 'INCOME' ? 'Credit' : 'Debit',
                    adjustmentAmount: formatNumber(absoluteCorrectionAmount),
                    reason: reason || 'Amount adjustment',
                    balance: formatNumber(moneyToString(balance)),
                };
                const smsMessage = await generateCorrectionNotificationSms(correctionParams);
                
                for (const lr of activeLeaders) {
                    if (lr.user.phone) await sendSms({ to: lr.user.phone, message: smsMessage }).catch(() => {});
                }
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
