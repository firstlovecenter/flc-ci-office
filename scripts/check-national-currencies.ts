import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Oversight Departments and Base Currencies:');
  console.log('========================================\n');

  const oversightDepts = await prisma.department.findMany({
    where: { level: 'OVERSIGHT' },
    include: {
      departmentBaseCurrency: {
        include: {
          currency: true,
        },
      },
    },
  });

  for (const dept of oversightDepts) {
    console.log(`Department: ${dept.name}`);
    console.log(`  ID: ${dept.id}`);
    if (dept.departmentBaseCurrency) {
      console.log(`  Base Currency: ${dept.departmentBaseCurrency.currency.code} - ${dept.departmentBaseCurrency.currency.name}`);
      console.log(`  Symbol: ${dept.departmentBaseCurrency.currency.symbol}`);
    } else {
      console.log(`  Base Currency: NOT SET (will use system default USD)`);
    }
    console.log('');
  }

  console.log(`\nTotal Oversight Departments: ${oversightDepts.length}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
