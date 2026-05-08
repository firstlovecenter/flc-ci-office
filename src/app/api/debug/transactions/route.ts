import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { toDecimal, eq, moneyToString } from '@/lib/money';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'SUPERADMIN') {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const transactions = await prisma.transaction.findMany({
            include: {
                currency: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 200,
        });

        const rates = await prisma.exchangeRate.findMany({
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
        });

        const report = {
            transactions: transactions.map(tx => {
                const expected = tx.exchangeRate
                    ? toDecimal(tx.amount).mul(toDecimal(tx.exchangeRate))
                    : null;
                const correct = tx.exchangeRate && tx.amountInBase
                    ? eq(tx.amountInBase, expected!)
                    : true;
                return {
                    id: tx.id,
                    type: tx.type,
                    amount: moneyToString(tx.amount),
                    currency: tx.currency?.code || null,
                    currencyId: tx.currencyId,
                    exchangeRate: tx.exchangeRate ? moneyToString(tx.exchangeRate) : null,
                    amountInBase: tx.amountInBase ? moneyToString(tx.amountInBase) : null,
                    expected: expected ? moneyToString(expected) : null,
                    correct,
                };
            }),
            exchangeRates: rates.map(r => ({
                from: r.fromCurrency.code,
                to: r.toCurrency.code,
                rate: moneyToString(r.rate),
            })),
        };

        return NextResponse.json(report);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
