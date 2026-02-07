import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash('@Jeremiah2:21#', 10);

  // Ensure global department exists
  const globalDept = await prisma.department.upsert({
    where: { id: 'global-1' },
    update: {},
    create: {
      id: 'global-1',
      name: 'Denomination Headquarters',
      level: 'DENOMINATION',
      updatedAt: new Date(),
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'skaduteye@gmail.com' },
    update: {
      password: hashedPassword,
      activeRole: 'SUPERADMIN',
      name: 'root',
      archived: false,
      updatedAt: new Date(),
    },
    create: {
      id: crypto.randomUUID(),
      email: 'skaduteye@gmail.com',
      phone: '0501234560',
      password: hashedPassword,
      activeRole: 'SUPERADMIN',
      name: 'root',
      archived: false,
      updatedAt: new Date(),
    },
  });

  // Create or update the UserRole relationship
  await prisma.userRole.upsert({
    where: {
      userId_role_departmentId: {
        userId: user.id,
        role: 'SUPERADMIN',
        departmentId: globalDept.id,
      },
    },
    update: {
      updatedAt: new Date(),
    },
    create: {
      id: crypto.randomUUID(),
      userId: user.id,
      role: 'SUPERADMIN',
      departmentId: globalDept.id,
      updatedAt: new Date(),
    },
  });

  console.log('✓ Superadmin user created/updated:', user.email);
  console.log('  Name:', user.name);
  console.log('  Active Role:', user.activeRole);
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
