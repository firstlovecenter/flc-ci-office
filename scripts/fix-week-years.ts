/**
 * Fix transactions that have incorrect year due to ISO week year bug
 * 
 * The bug: When creating transactions near year boundaries (e.g., Dec 29-31),
 * the code used getYear() instead of getISOWeekYear(), causing transactions
 * to be stored with the calendar year instead of the ISO week year.
 * 
 * Example: A transaction created on Dec 30, 2025 (which is ISO Week 1 of 2026)
 * was incorrectly stored as weekNumber=1, year=2025 instead of weekNumber=1, year=2026.
 * 
 * Run with: npx tsx scripts/fix-week-years.ts
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { getISOWeek, getISOWeekYear } from 'date-fns';

async function fixWeekYears() {
    console.log('🔧 Fixing transaction week years...\n');

    // Find all transactions
    const transactions = await prisma.transaction.findMany({
        select: {
            id: true,
            createdAt: true,
            weekNumber: true,
            year: true,
        },
    });

    console.log(`Found ${transactions.length} transactions to check.\n`);

    let fixedCount = 0;
    const fixes: { id: string; oldYear: number; newYear: number; weekNumber: number; date: string }[] = [];

    for (const tx of transactions) {
        const correctWeek = getISOWeek(tx.createdAt);
        const correctYear = getISOWeekYear(tx.createdAt);

        // Check if the year needs to be corrected
        if (tx.year !== correctYear || tx.weekNumber !== correctWeek) {
            fixes.push({
                id: tx.id,
                oldYear: tx.year,
                newYear: correctYear,
                weekNumber: correctWeek,
                date: tx.createdAt.toISOString().split('T')[0],
            });

            await prisma.transaction.update({
                where: { id: tx.id },
                data: {
                    weekNumber: correctWeek,
                    year: correctYear,
                },
            });

            fixedCount++;
        }
    }

    if (fixedCount > 0) {
        console.log(`✅ Fixed ${fixedCount} transactions:\n`);
        console.log('Date       | Week | Old Year -> New Year');
        console.log('-----------|------|---------------------');
        for (const fix of fixes) {
            console.log(`${fix.date} | W${String(fix.weekNumber).padStart(2, ' ')}  | ${fix.oldYear} -> ${fix.newYear}`);
        }
    } else {
        console.log('✅ All transactions have correct week years.');
    }

    console.log('\n✨ Done!');
}

fixWeekYears()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    });
