const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv/config');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Adding default phone numbers to users without phones...');

  try {
    // Use raw SQL to update all users without phones in one query
    const result = await prisma.$executeRaw`
      UPDATE "User" 
      SET phone = CONCAT('233000', SUBSTRING(id FROM 1 FOR 6))
      WHERE phone IS NULL
    `;

    console.log(`Successfully updated ${result} users with placeholder phone numbers`);

    // Verify the update
    const updatedUsers = await prisma.user.findMany({
      where: {
        phone: {
          startsWith: '233000'
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true
      }
    });

    console.log('\nUpdated users:');
    updatedUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}): ${user.phone}`);
    });

    console.log('\n✅ All users now have phone numbers!');
    console.log('⚠️  IMPORTANT: Ask users to update their phone numbers in their profile');

  } catch (error) {
    console.error('Error updating users:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
