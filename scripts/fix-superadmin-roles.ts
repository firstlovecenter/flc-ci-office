import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fixing superadmin roles for skaduteye@gmail.com...');

  // Get the user
  const user = await prisma.user.findUnique({
    where: { email: 'skaduteye@gmail.com' },
    include: {
      userRoles: {
        include: {
          department: true,
        },
      },
    },
  });

  if (!user) {
    console.error('User skaduteye@gmail.com not found!');
    return;
  }

  console.log('Current user roles:', user.userRoles);

  // Delete all existing user roles for this user
  await prisma.userRole.deleteMany({
    where: { userId: user.id },
  });
  console.log('Deleted all existing user roles');

  // Update user to have no department, SUPERADMIN role only
  await prisma.user.update({
    where: { id: user.id },
    data: {
      activeUserRoleId: null,
      activeRole: 'SUPERADMIN',
      roles: ['SUPERADMIN'],
      departmentId: null,
    },
  });
  console.log('Updated user: no department, SUPERADMIN role only');

  console.log('✓ Fixed superadmin roles successfully!');
}

main()
  .catch((e) => {
    console.error('Error fixing superadmin roles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
