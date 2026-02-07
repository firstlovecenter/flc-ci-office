import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

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

    // Create UserRole from activeRole if user has one
    const createdUserRoles = [];
    
    if (user.activeRole && user.departmentId) {
      // Check if userRole already exists
      const existing = await prisma.userRole.findFirst({
        where: {
          userId: user.id,
          role: user.activeRole,
          departmentId: user.departmentId,
        },
      });

      if (!existing) {
        const created = await prisma.userRole.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            role: user.activeRole,
            departmentId: user.departmentId,
            updatedAt: new Date(),
          },
          include: {
            department: true,
          },
        });
        createdUserRoles.push(created);

        // Set as active role
        await prisma.user.update({
          where: { id: user.id },
          data: {
            activeUserRoleId: created.id,
            updatedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      message: createdUserRoles.length > 0 ? 'User roles fixed successfully' : 'No roles to migrate',
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
