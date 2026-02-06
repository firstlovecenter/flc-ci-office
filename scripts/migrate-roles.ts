// Migration script to convert single role to roles array
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration: Converting single role to roles array...');

    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
        },
    });

    console.log(`Found ${users.length} users to migrate`);

    for (const user of users) {
        try {
            // Since the old 'role' column is dropped, we need to set a default
            // The database should have the default from the schema
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    // roles will default to [COUNCIL_LEADER] from schema
                    // Set activeRole to the first role in the array
                    activeRole: 'COUNCIL_LEADER',
                },
            });
            console.log(`✓ Migrated user: ${user.email}`);
        } catch (error) {
            console.error(`✗ Failed to migrate user ${user.email}:`, error);
        }
    }

    console.log('Migration completed!');
}

main()
    .catch((e) => {
        console.error('Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
