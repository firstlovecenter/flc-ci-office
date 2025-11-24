import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

        // Only SUPERADMIN and GLOBAL_ADMIN can update currencies
        if (!['SUPERADMIN', 'GLOBAL_ADMIN'].includes(session.user.role)) {
            return new NextResponse('Forbidden - Only SUPERADMIN or GLOBAL_ADMIN can manage currencies', { status: 403 });
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

        // If setting as base currency, unset other base currencies
        if (isBase && !currency.isBase) {
            await prisma.currency.updateMany({
                where: { isBase: true, id: { not: params.id } },
                data: { isBase: false },
            });
        }

        const updatedCurrency = await prisma.currency.update({
            where: { id: params.id },
            data: {
                name,
                symbol,
                isBase,
            },
        });

        // If base currency changed, recalculate all transactions
        if (isBase && !currency.isBase) {
            // Get all exchange rates for conversion to new base currency
            const exchangeRates = await prisma.exchangeRate.findMany({
                include: {
                    fromCurrency: true,
                    toCurrency: true,
                },
            });

            // Get all transactions
            const transactions = await prisma.transaction.findMany({
                where: { currencyId: { not: null } },
                include: { currency: true },
            });

            // Recalculate each transaction
            for (const tx of transactions) {
                let newAmountInBase = Number(tx.amount);

                if (tx.currencyId === params.id) {
                    // Transaction is in the new base currency - use original amount
                    newAmountInBase = Number(tx.amount);
                } else if (tx.currencyId) {
                    // Transaction is in a different currency - convert to new base
                    // Find exchange rate: transaction currency → new base currency
                    let rate = exchangeRates.find(
                        (r) => r.fromCurrency.id === tx.currencyId && r.toCurrency.id === params.id
                    );

                    if (rate) {
                        // Direct rate found: txCurrency → newBase
                        newAmountInBase = Number(tx.amount) * parseFloat(rate.rate.toString());
                    } else {
                        // Try reverse: newBase → txCurrency
                        rate = exchangeRates.find(
                            (r) => r.fromCurrency.id === params.id && r.toCurrency.id === tx.currencyId
                        );
                        if (rate) {
                            // Invert the rate
                            newAmountInBase = Number(tx.amount) / parseFloat(rate.rate.toString());
                        }
                    }
                }

                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: { amountInBase: newAmountInBase },
                });
            }
        }

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Currency',
                entityId: params.id,
                beforeData: currency as any,
                afterData: updatedCurrency as any,
            },
        });

        return NextResponse.json(updatedCurrency);
    } catch (error) {\n        return new NextResponse('Internal Server Error', { status: 500 });
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

        // Only SUPERADMIN and GLOBAL_ADMIN can update currencies
        if (!['SUPERADMIN', 'GLOBAL_ADMIN'].includes(session.user.role)) {
            return new NextResponse('Forbidden - Only SUPERADMIN or GLOBAL_ADMIN can manage currencies', { status: 403 });
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

        // If setting as base currency, unset other base currencies
        if (isBase && !currency.isBase) {
            await prisma.currency.updateMany({
                where: { isBase: true, id: { not: params.id } },
                data: { isBase: false },
            });
        }

        const updatedCurrency = await prisma.currency.update({
            where: { id: params.id },
            data: {
                name: name || undefined,
                symbol: symbol || undefined,
                isBase: isBase !== undefined ? isBase : undefined,
                isActive: isActive !== undefined ? isActive : undefined,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
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
