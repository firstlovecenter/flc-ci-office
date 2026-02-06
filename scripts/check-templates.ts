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

async function main() {
    const templates = await prisma.smsTemplate.findMany({
        orderBy: { key: 'asc' }
    });

    console.log('\n=== SMS TEMPLATES IN DATABASE ===\n');
    
    templates.forEach((template, index) => {
        console.log(`${index + 1}. ${template.name} (${template.key})`);
        console.log(`   Description: ${template.description}`);
        console.log(`   Template: ${template.template}`);
        console.log(`   Variables: ${template.variables.join(', ')}`);
        console.log('');
    });

    console.log(`Total templates: ${templates.length}`);
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
