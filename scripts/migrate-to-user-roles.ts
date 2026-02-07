import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Validating UserRole migration...');

  // Get all users with their current roles and departments
  const users = await prisma.user.findMany({
    where: {
      archived: false,
    },
    include: {
      department: true,
      userRoles: true,
    },
  });

  console.log(`Found ${users.length} users to validate`);

  for (const user of users) {
    console.log(`\nValidating user: ${user.email}`);
    console.log(`  Active role: ${user.activeRole}`);
    console.log(`  User roles count: ${user.userRoles.length}`);
    console.log(`  Department: ${user.department?.name || 'None'}`);
    console.log(`  Current UserRoles: ${user.userRoles.map(ur => ur.role).join(', ') || 'None'}`);

    if (!user.departmentId) {
      console.log(`  ⚠️  Skipping - no department assigned`);
      continue;
    }

    // If user has active role but no UserRole entry for it, create one
    if (user.activeRole) {
      const existingRole = user.userRoles.find(ur => ur.role === user.activeRole);
      
      if (!existingRole) {
        try {
          const userRole = await prisma.userRole.create({
            data: {
              id: crypto.randomUUID(),
              userId: user.id,
              role: user.activeRole,
              departmentId: user.departmentId,
              updatedAt: new Date(),
            },
          });
          console.log(`  ✓ Created missing UserRole: ${user.activeRole}`);

          // Set as active if not already set
          if (!user.activeUserRoleId) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                activeUserRoleId: userRole.id,
                updatedAt: new Date(),
              },
            });
            console.log(`  ✓ Set as active UserRole`);
          }
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`  ⚠️  UserRole already exists: ${user.activeRole}`);
          } else {
            console.error(`  ✗ Error creating UserRole:`, error.message);
          }
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
            updatedAt: new Date(),
          },
        });
        console.log(`  ✓ Fixed activeUserRoleId`);
      }
    }
  }

  console.log('\n✓ UserRole migration validation completed!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
