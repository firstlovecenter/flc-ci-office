import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { sendSms } from '@/lib/sms';
import { generateCorrectionNotificationSms } from '@/lib/sms-templates';
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
        const { newAmount, reason } = body;
        const originalTransactionId = params.id;

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

        // Calculate the difference
        const originalAmount = Number(originalTransaction.amount);
        const newAmountValue = Number(newAmount);
        const correctionAmount = newAmountValue - originalAmount;

        if (correctionAmount === 0) {
            return NextResponse.json(
                { error: 'New amount is the same as the original amount' },
                { status: 400 }
            );
        }

        // The correction should reverse part/all of the original and apply the difference
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
