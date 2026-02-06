import { prisma } from './src/lib/prisma.ts';

async function main() {
  const depts = await prisma.department.findMany({
    select: {
      id: true,
      name: true,
      level: true,
      parentId: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  console.log('All departments:');
  console.log(JSON.stringify(depts, null, 2));
  
  await prisma.$disconnect();
}

main();
