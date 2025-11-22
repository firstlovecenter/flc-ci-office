import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Checking users with empty roles array...');

  // This query will find users and update them based on database state
  const query = `
    UPDATE "User"
    SET 
      roles = CASE 
        WHEN email = 'skaduteye@gmail.com' THEN ARRAY['SUPERADMIN']::"Role"[]
        WHEN roles IS NULL OR array_length(roles, 1) IS NULL THEN ARRAY['COUNCIL_LEADER']::"Role"[]
        ELSE roles
      END,
      "activeRole" = CASE
        WHEN email = 'skaduteye@gmail.com' THEN 'SUPERADMIN'::"Role"
        WHEN "activeRole" IS NULL THEN 
          CASE 
            WHEN array_length(roles, 1) > 0 THEN roles[1]
            ELSE 'COUNCIL_LEADER'::"Role"
          END
        ELSE "activeRole"
      END
    WHERE roles IS NULL OR array_length(roles, 1) IS NULL OR "activeRole" IS NULL OR email = 'skaduteye@gmail.com'
    RETURNING id, email, roles, "activeRole";
  `;

  const result = await prisma.$queryRawUnsafe(query);
  
  console.log('\n✓ Updated users:');
  console.log(result);
  
  console.log('\n✓ All users fixed!');
}

main()
  .catch((e) => {
    console.error('Error fixing user roles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
