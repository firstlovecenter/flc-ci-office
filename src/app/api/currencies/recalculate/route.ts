import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN and GLOBAL_ADMIN can trigger recalculation
        if (!['SUPERADMIN', 'GLOBAL_ADMIN'].includes(session.user.role)) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Get the new base currency
        const baseCurrency = await prisma.currency.findFirst({
            where: { isBase: true },
        });

        if (!baseCurrency) {
            return new NextResponse('No base currency found', { status: 400 });
        }

        // Get all exchange rates
        const exchangeRates = await prisma.exchangeRate.findMany({
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
        });

        // Get all transactions that have a currency
        const transactions = await prisma.transaction.findMany({
            where: {
                currencyId: { not: null },
            },
            include: {
                currency: true,
            },
        });

        let updatedCount = 0;
        let errors = [];

        for (const tx of transactions) {
            try {
                let newAmountInBase = Number(tx.amount);

                // If transaction currency is same as base, no conversion needed
                if (tx.currencyId === baseCurrency.id) {
                    newAmountInBase = Number(tx.amount);
                } else if (tx.currencyId) {
                    // Find exchange rate from transaction currency to base currency
                    let rate = exchangeRates.find(
                        (r) => r.fromCurrency.id === tx.currencyId && r.toCurrency.id === baseCurrency.id
                    );

                    // If not found, try reverse and invert
                    if (!rate) {
                        rate = exchangeRates.find(
                            (r) => r.fromCurrency.id === baseCurrency.id && r.toCurrency.id === tx.currencyId
                        );
                        if (rate) {
                            newAmountInBase = Number(tx.amount) / parseFloat(rate.rate.toString());
                        }
                    } else {
                        newAmountInBase = Number(tx.amount) * parseFloat(rate.rate.toString());
                    }
                }

                // Update the transaction
                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: {
                        amountInBase: newAmountInBase,
                    },
                });

                updatedCount++;
            } catch (error) {
                console.error(`Error updating transaction ${tx.id}:`, error);
                errors.push({ transactionId: tx.id, error: String(error) });
            }
        }

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Transaction',
                entityId: 'BULK',
                afterData: {
                    action: 'recalculate_base_currency',
                    newBaseCurrency: baseCurrency.code,
                    transactionsUpdated: updatedCount,
                    errors: errors.length,
                },
            },
        });

        return NextResponse.json({
            success: true,
            baseCurrency: baseCurrency.code,
            transactionsUpdated: updatedCount,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('Recalculate error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
