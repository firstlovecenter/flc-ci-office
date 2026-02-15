import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
            transactions: transactions.map(tx => ({
                id: tx.id,
                type: tx.type,
                amount: Number(tx.amount),
                currency: tx.currency?.code || null,
                currencyId: tx.currencyId,
                exchangeRate: tx.exchangeRate ? Number(tx.exchangeRate) : null,
                amountInBase: tx.amountInBase ? Number(tx.amountInBase) : null,
                expected: tx.exchangeRate ? Number(tx.amount) * Number(tx.exchangeRate) : null,
                correct: tx.exchangeRate && tx.amountInBase 
                    ? Math.abs(Number(tx.amountInBase) - (Number(tx.amount) * Number(tx.exchangeRate))) < 0.01
                    : true,
            })),
            exchangeRates: rates.map(r => ({
                from: r.fromCurrency.code,
                to: r.toCurrency.code,
                rate: Number(r.rate),
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
