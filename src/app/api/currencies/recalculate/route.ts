import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { toDecimal } from '@/lib/money';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN and DENOMINATION_ADMIN can trigger recalculation
        if (!['SUPERADMIN', 'DENOMINATION_ADMIN'].includes(session.user.role)) {
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
                const txAmount = toDecimal(tx.amount);
                let newAmountInBase = txAmount;

                if (tx.currencyId && tx.currencyId !== baseCurrency.id) {
                    let rate = exchangeRates.find(
                        (r) => r.fromCurrency.id === tx.currencyId && r.toCurrency.id === baseCurrency.id
                    );
                    if (rate) {
                        newAmountInBase = txAmount.mul(toDecimal(rate.rate));
                    } else {
                        rate = exchangeRates.find(
                            (r) => r.fromCurrency.id === baseCurrency.id && r.toCurrency.id === tx.currencyId
                        );
                        if (rate) {
                            newAmountInBase = txAmount.div(toDecimal(rate.rate));
                        } else {
                            errors.push({ transactionId: tx.id, error: `No exchange rate found for currency ${tx.currency?.code || tx.currencyId} to base currency ${baseCurrency.code}` });
                            continue;
                        }
                    }
                }

                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: { amountInBase: newAmountInBase.toString() },
                });

                updatedCount++;
            } catch (error) {
                errors.push({ transactionId: tx.id, error: String(error) });
            }
        }

        // Create audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
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
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
