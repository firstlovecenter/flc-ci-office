import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only superadmin can run this fix
    if (session.user.role !== 'SUPERADMIN') {
        return new NextResponse('Forbidden - SUPERADMIN only', { status: 403 });
    }

    return new NextResponse(`
        <html>
            <body>
                <h1>Transaction Conversion Fix</h1>
                <p>This will fix all transactions that have incorrect or null amountInBase values.</p>
                <button onclick="runFix()">Run Fix</button>
                <div id="result"></div>
                <script>
                    async function runFix() {
                        document.getElementById('result').textContent = 'Running...';
                        const response = await fetch('/api/transactions/fix-conversions', {
                            method: 'POST',
                        });
                        const data = await response.json();
                        document.getElementById('result').textContent = JSON.stringify(data, null, 2);
                    }
                </script>
            </body>
        </html>
    `, {
        headers: { 'Content-Type': 'text/html' },
    });
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only superadmin can run this fix
    if (session.user.role !== 'SUPERADMIN') {
        return new NextResponse('Forbidden - SUPERADMIN only', { status: 403 });
    }

    try {

        // Get all transactions
        const transactions = await prisma.transaction.findMany({
            select: {
                id: true,
                amount: true,
                currencyId: true,
                exchangeRate: true,
                amountInBase: true,
            },
        });

        let fixedCount = 0;
        const updates = [];

        for (const transaction of transactions) {
            let correctAmountInBase = Number(transaction.amount);

            // If there's a currency and exchange rate, apply conversion
            if (transaction.currencyId && transaction.exchangeRate) {
                correctAmountInBase = Number(transaction.amount) * Number(transaction.exchangeRate);
            }

            // Check if amountInBase needs updating
            const currentAmountInBase = Number(transaction.amountInBase || 0);
            
            if (currentAmountInBase !== correctAmountInBase) {
                updates.push(
                    prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { amountInBase: correctAmountInBase },
                    })
                );
                fixedCount++;
            }
        }

        // Execute all updates
        if (updates.length > 0) {
            await Promise.all(updates);
        }

        return NextResponse.json({
            success: true,
            message: `Fixed ${fixedCount} out of ${transactions.length} transactions`,
            fixed: fixedCount,
            total: transactions.length,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
