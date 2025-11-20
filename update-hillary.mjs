import { prisma } from './src/lib/prisma.js';

async function updateHillaryDepartment() {
  try {
    // Find Hillary's user
    const hillary = await prisma.user.findUnique({
      where: { email: 'hillaryagyeman@gmail.com' },
      include: { department: true }
    });

    if (!hillary) {
      console.log('Hillary user not found');
      return;
    }

    console.log('Current Hillary data:');
    console.log('- Email:', hillary.email);
    console.log('- Current Department ID:', hillary.departmentId);
    console.log('- Current Department:', hillary.department?.name, '-', hillary.department?.level);

    // Find REVIVAL campus
    const revival = await prisma.department.findFirst({
      where: { 
        name: 'REVIVAL',
        level: 'CAMPUS'
      }
    });

    if (!revival) {
      console.log('REVIVAL campus not found');
      return;
    }

    console.log('\nREVIVAL campus:');
    console.log('- ID:', revival.id);
    console.log('- Name:', revival.name);
    console.log('- Level:', revival.level);

    // Update Hillary's department to REVIVAL
    const updated = await prisma.user.update({
      where: { id: hillary.id },
      data: { departmentId: revival.id }
    });

    console.log('\n✓ Updated Hillary\'s department to REVIVAL');
    console.log('- New Department ID:', updated.departmentId);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

updateHillaryDepartment();
