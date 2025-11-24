import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Emergency endpoint to fix user roles - should be removed after use
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        department: true,
        userRoles: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user already has userRoles, no need to migrate
    if (user.userRoles.length > 0) {
      return NextResponse.json({ 
        message: 'User already has userRoles',
        userRoles: user.userRoles 
      });
    }

    // Migrate from old roles array to UserRole table
    const userRolesToCreate = [];
    
    for (const role of user.roles) {
      // Skip if userRole already exists
      const existing = await prisma.userRole.findFirst({
        where: {
          userId: user.id,
          role: role as any,
          departmentId: user.departmentId || undefined,
        },
      });

      if (!existing && user.departmentId) {
        userRolesToCreate.push({
          userId: user.id,
          role: role as any,
          departmentId: user.departmentId,
        });
      }
    }

    // Create UserRole entries
    const createdUserRoles = [];
    for (const userRoleData of userRolesToCreate) {
      const created = await prisma.userRole.create({
        data: userRoleData,
        include: {
          department: true,
        },
      });
      createdUserRoles.push(created);
    }

    // Set first one as active if no active role is set
    if (createdUserRoles.length > 0 && !user.activeUserRoleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          activeUserRoleId: createdUserRoles[0].id,
        },
      });
    }

    return NextResponse.json({
      message: 'User roles fixed successfully',
      email: user.email,
      userRolesCreated: createdUserRoles.length,
      userRoles: createdUserRoles,
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to fix user roles',
      details: error.message 
    }, { status: 500 });
  }
}
