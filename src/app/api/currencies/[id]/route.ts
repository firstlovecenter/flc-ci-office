import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { toDecimal, toMoney2dp } from '@/lib/money';

// Full update a currency
export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN and DENOMINATION_ADMIN can update currencies
        if (!['SUPERADMIN', 'DENOMINATION_ADMIN'].includes(session.user.role)) {
            return new NextResponse('Forbidden - Only SUPERADMIN or DENOMINATION_ADMIN can manage currencies', { status: 403 });
        }

        const params = await context.params;
        const body = await req.json();
        const { name, symbol, isBase } = body;

        const currency = await prisma.currency.findUnique({
            where: { id: params.id },
        });

        if (!currency) {
            return new NextResponse('Currency not found', { status: 404 });
        }

        // If setting as base currency, wrap entire operation in a transaction
        if (isBase && !currency.isBase) {
            const result = await prisma.$transaction(async (tx) => {
                // Unset other base currencies
                await tx.currency.updateMany({
                    where: { isBase: true, id: { not: params.id } },
                    data: { isBase: false },
                });

                // Update this currency
                const updatedCurrency = await tx.currency.update({
                    where: { id: params.id },
                    data: { name, symbol, isBase },
                });

                // Get all exchange rates for conversion to new base currency
                const exchangeRates = await tx.exchangeRate.findMany({
                    include: {
                        fromCurrency: true,
                        toCurrency: true,
                    },
                });

                // Get all transactions with currencies
                const transactions = await tx.transaction.findMany({
                    where: { currencyId: { not: null } },
                    include: { currency: true },
                });

                // Batch recalculate amountInBase using Decimal arithmetic
                for (const txn of transactions) {
                    const txAmount = toDecimal(txn.amount);
                    let newAmountInBase = txAmount;

                    if (txn.currencyId && txn.currencyId !== params.id) {
                        let rate = exchangeRates.find(
                            (r) => r.fromCurrency.id === txn.currencyId && r.toCurrency.id === params.id
                        );
                        if (rate) {
                            newAmountInBase = txAmount.mul(toDecimal(rate.rate));
                        } else {
                            rate = exchangeRates.find(
                                (r) => r.fromCurrency.id === params.id && r.toCurrency.id === txn.currencyId
                            );
                            if (rate) {
                                newAmountInBase = txAmount.div(toDecimal(rate.rate));
                            }
                        }
                    }

                    await tx.transaction.update({
                        where: { id: txn.id },
                        data: { amountInBase: toMoney2dp(newAmountInBase) },
                    });
                }

                // Create audit log in same transaction
                await tx.auditLog.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: session.user.id,
                        actionType: 'UPDATE',
                        entityType: 'Currency',
                        entityId: params.id,
                        beforeData: currency as any,
                        afterData: updatedCurrency as any,
                    },
                });

                return updatedCurrency;
            }, { timeout: 60000 }); // 60s timeout for large transaction sets

            return NextResponse.json(result);
        }

        // Non-base-currency update (simple case)
        const updatedCurrency = await prisma.currency.update({
            where: { id: params.id },
            data: { name, symbol, isBase },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Currency',
                entityId: params.id,
                beforeData: currency as any,
                afterData: updatedCurrency as any,
            },
        });

        return NextResponse.json(updatedCurrency);
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// Update a currency (partial)
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN and DENOMINATION_ADMIN can update currencies
        if (!['SUPERADMIN', 'DENOMINATION_ADMIN'].includes(session.user.role)) {
            return new NextResponse('Forbidden - Only SUPERADMIN or DENOMINATION_ADMIN can manage currencies', { status: 403 });
        }

        const params = await context.params;
        const body = await req.json();
        const { name, symbol, isBase, isActive } = body;

        const currency = await prisma.currency.findUnique({
            where: { id: params.id },
        });

        if (!currency) {
            return new NextResponse('Currency not found', { status: 404 });
        }

        // Reject isBase changes via PATCH — use PUT instead which handles recalculation
        if (isBase !== undefined && isBase !== currency.isBase) {
            return new NextResponse('Cannot change base currency via PATCH. Use PUT to change base currency (triggers recalculation).', { status: 400 });
        }

        const updatedCurrency = await prisma.currency.update({
            where: { id: params.id },
            data: {
                name: name || undefined,
                symbol: symbol || undefined,
                isActive: isActive !== undefined ? isActive : undefined,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Currency',
                entityId: params.id,
                beforeData: currency as any,
                afterData: updatedCurrency as any,
            },
        });

        return NextResponse.json(updatedCurrency);
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// Delete a currency
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN can delete currencies
        if (session.user.role !== 'SUPERADMIN') {
            return new NextResponse('Forbidden - Only SUPERADMIN can delete currencies', { status: 403 });
        }

        const params = await context.params;

        const currency = await prisma.currency.findUnique({
            where: { id: params.id },
            include: {
                transactions: { take: 1 },
            },
        });

        if (!currency) {
            return new NextResponse('Currency not found', { status: 404 });
        }

        // Prevent deleting base currency
        if (currency.isBase) {
            return new NextResponse('Cannot delete base currency', { status: 400 });
        }

        // Prevent deleting if used in transactions
        if (currency.transactions.length > 0) {
            return new NextResponse('Cannot delete currency that has been used in transactions', { status: 400 });
        }

        await prisma.currency.delete({
            where: { id: params.id },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'DELETE',
                entityType: 'Currency',
                entityId: params.id,
                beforeData: currency as any,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
