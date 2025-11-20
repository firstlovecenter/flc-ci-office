const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function fixTransactionConversions() {
    try {
        console.log('Checking transactions for conversion issues...\n');

        // Get all transactions
        const allTransactions = await prisma.transaction.findMany({
            include: {
                currency: true,
            },
        });

        console.log(`Found ${allTransactions.length} total transactions\n`);

        let fixedCount = 0;

        for (const transaction of allTransactions) {
            // Convert Decimal to number for calculations
            const amount = Number(transaction.amount);
            const exchangeRate = transaction.exchangeRate ? Number(transaction.exchangeRate) : null;
            const currentAmountInBase = transaction.amountInBase ? Number(transaction.amountInBase) : null;

            let correctAmountInBase = amount;

            // If there's an exchange rate and currency, apply it
            if (transaction.currencyId && exchangeRate) {
                correctAmountInBase = amount * exchangeRate;
            }

            // Check if amountInBase needs updating
            const needsUpdate = currentAmountInBase === null || 
                               Math.abs(currentAmountInBase - correctAmountInBase) > 0.01;

            if (needsUpdate) {
                console.log(`Fixing transaction ${transaction.id}:`);
                console.log(`  Type: ${transaction.type}`);
                console.log(`  Currency: ${transaction.currency?.code || 'Base Currency'}`);
                console.log(`  Amount: ${amount}`);
                console.log(`  Exchange Rate: ${exchangeRate || 'N/A'}`);
                console.log(`  Current amountInBase: ${currentAmountInBase}`);
                console.log(`  Correct amountInBase: ${correctAmountInBase}`);

                await prisma.transaction.update({
                    where: { id: transaction.id },
                    data: { amountInBase: correctAmountInBase },
                });

                console.log(`  ✓ Fixed!\n`);
                fixedCount++;
            }
        }

        console.log(`\n✅ Fixed ${fixedCount} transactions`);
        
        // Show summary
        const stats = await prisma.transaction.groupBy({
            by: ['type'],
            where: {
                status: 'APPROVED',
            },
            _sum: {
                amountInBase: true,
            },
        });

        console.log('\nCurrent Dashboard Totals (Approved Transactions):');
        stats.forEach(stat => {
            console.log(`  ${stat.type}: ${Number(stat._sum.amountInBase || 0).toFixed(2)}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixTransactionConversions();
