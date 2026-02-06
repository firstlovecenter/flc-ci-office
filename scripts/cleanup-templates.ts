import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config();

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
    log: ['error', 'warn'],
});

const templatesToDelete = [
    'DEBIT_ALERT',           // Replaced by TRANSACTION_CHARGE
    'TRANSACTION_PENDING',   // Duplicate of PENDING_APPROVAL_REQUEST
    'week_lock_notification', // Feature doesn't exist
    'approval_reminder',      // Feature doesn't exist
];

async function main() {
    console.log('Cleaning up redundant SMS templates...\n');

    for (const key of templatesToDelete) {
        try {
            const result = await prisma.smsTemplate.delete({
                where: { key },
            });
            console.log(`✓ Deleted: ${result.name} (${result.key})`);
        } catch (error: any) {
            if (error.code === 'P2025') {
                console.log(`- Already deleted: ${key}`);
            } else {
                console.error(`✗ Error deleting ${key}:`, error.message);
            }
        }
    }

    console.log('\nCleanup complete!');
    
    // Show remaining templates
    const remaining = await prisma.smsTemplate.findMany({
        orderBy: { key: 'asc' },
        select: {
            key: true,
            name: true,
        }
    });
    
    console.log(`\nRemaining templates (${remaining.length}):`);
    remaining.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.name} (${t.key})`);
    });
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
