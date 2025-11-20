import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixTransactionConversions() {
    try {
        console.log('Checking transactions for conversion issues...');

        // Find all transactions with currency and exchange rate
        const transactions = await prisma.transaction.findMany({
            where: {
                currencyId: { not: null },
            },
            include: {
                currency: true,
            },
        });

        console.log(`Found ${transactions.length} transactions with currencies`);

        let fixedCount = 0;
        
        for (const transaction of transactions) {
            let correctAmountInBase = transaction.amount;

            // If there's an exchange rate, apply it
            if (transaction.exchangeRate) {
                correctAmountInBase = transaction.amount * transaction.exchangeRate;
            }

            // Check if amountInBase needs updating
            if (transaction.amountInBase !== correctAmountInBase) {
                console.log(`\nFixing transaction ${transaction.id}:`);
                console.log(`  Currency: ${transaction.currency?.code || 'N/A'}`);
                console.log(`  Amount: ${transaction.amount}`);
                console.log(`  Exchange Rate: ${transaction.exchangeRate}`);
                console.log(`  Current amountInBase: ${transaction.amountInBase}`);
                console.log(`  Correct amountInBase: ${correctAmountInBase}`);

                await prisma.transaction.update({
                    where: { id: transaction.id },
                    data: { amountInBase: correctAmountInBase },
                });

                fixedCount++;
            }
        }

        // Also fix transactions with null amountInBase
        const nullAmountInBase = await prisma.transaction.findMany({
            where: {
                amountInBase: null,
            },
        });

        console.log(`\nFound ${nullAmountInBase.length} transactions with null amountInBase`);

        for (const transaction of nullAmountInBase) {
            let correctAmountInBase = transaction.amount;

            if (transaction.exchangeRate && transaction.currencyId) {
                correctAmountInBase = transaction.amount * transaction.exchangeRate;
            }

            console.log(`\nFixing transaction ${transaction.id} (null amountInBase):`);
            console.log(`  Amount: ${transaction.amount}`);
            console.log(`  Setting amountInBase to: ${correctAmountInBase}`);

            await prisma.transaction.update({
                where: { id: transaction.id },
                data: { amountInBase: correctAmountInBase },
            });

            fixedCount++;
        }

        console.log(`\n✅ Fixed ${fixedCount} transactions`);
        console.log('Done!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixTransactionConversions();
