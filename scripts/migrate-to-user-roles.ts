import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration to UserRole model...');

  // Get all users with their current roles and departments
  const users = await prisma.user.findMany({
    where: {
      archived: false,
    },
    include: {
      department: true,
    },
  });

  console.log(`Found ${users.length} users to migrate`);

  for (const user of users) {
    console.log(`\nMigrating user: ${user.email}`);
    console.log(`  Current roles: ${user.roles.join(', ')}`);
    console.log(`  Active role: ${user.activeRole}`);
    console.log(`  Department: ${user.department?.name || 'None'}`);

    if (!user.departmentId) {
      console.log(`  ⚠️  Skipping - no department assigned`);
      continue;
    }

    // Create UserRole entries for each role the user has
    for (const role of user.roles) {
      try {
        const userRole = await prisma.userRole.create({
          data: {
            userId: user.id,
            role: role,
            departmentId: user.departmentId,
          },
        });
        console.log(`  ✓ Created UserRole: ${role} for ${user.department?.name}`);

        // If this is the active role, set it as the active user role
        if (role === user.activeRole) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              activeUserRoleId: userRole.id,
            },
          });
          console.log(`  ✓ Set as active UserRole`);
        }
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`  ⚠️  UserRole already exists: ${role} for ${user.department?.name}`);
        } else {
          console.error(`  ✗ Error creating UserRole:`, error.message);
        }
      }
    }

    // If user has active role but no activeUserRoleId set, try to find and set it
    if (user.activeRole && !user.activeUserRoleId) {
      const activeUserRole = await prisma.userRole.findFirst({
        where: {
          userId: user.id,
          role: user.activeRole,
          departmentId: user.departmentId,
        },
      });

      if (activeUserRole) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            activeUserRoleId: activeUserRole.id,
          },
        });
        console.log(`  ✓ Fixed activeUserRoleId`);
      }
    }
  }

  console.log('\n✓ Migration completed!');
  console.log('\nNext steps:');
  console.log('1. Verify the data in the UserRole table');
  console.log('2. Update application code to use UserRole instead of roles array');
  console.log('3. After thorough testing, the old roles, activeRole, and departmentId fields can be removed');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
