import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { getISOWeek, getISOWeekYear } from 'date-fns';

async function checkTransactions() {
  const transactions = await prisma.transaction.findMany({
    select: {
      id: true,
      description: true,
      createdAt: true,
      weekNumber: true,
      year: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  
  console.log('Recent Transactions:');
  console.log('Date       | Stored Week/Year | Correct Week/Year');
  console.log('-----------|------------------|------------------');
  
  for (const tx of transactions) {
    const correctWeek = getISOWeek(tx.createdAt);
    const correctYear = getISOWeekYear(tx.createdAt);
    const needsFix = tx.weekNumber !== correctWeek || tx.year !== correctYear;
    console.log(
      tx.createdAt.toISOString().split('T')[0] + 
      ' | W' + tx.weekNumber + ' ' + tx.year + 
      '          | W' + correctWeek + ' ' + correctYear +
      (needsFix ? ' ❌ WRONG' : ' ✓')
    );
  }
}

checkTransactions().then(() => process.exit(0));
