import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash('@Jeremiah2:21#', 10);

  const user = await prisma.user.upsert({
    where: { email: 'skaduteye@gmail.com' },
    update: {
      password: hashedPassword,
      roles: ['SUPERADMIN'],
      name: 'root',
      archived: false,
    },
    create: {
      email: 'skaduteye@gmail.com',
      phone: '0501234560',
      password: hashedPassword,
      roles: ['SUPERADMIN'],
      name: 'root',
      archived: false,
    },
  });

  console.log('✓ Superadmin user created/updated:', user.email);
  console.log('  Name:', user.name);
  console.log('  Roles:', user.roles);
}

main()
  .catch((e) => {
    console.error('Error creating superadmin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
