import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET() {
  try {
    // Check if user is authenticated and is a SUPERADMIN
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        userRoles: true,
      },
    });

    const isSuperAdmin = user?.activeRole === 'SUPERADMIN' || 
                         user?.userRoles.some(ur => ur.role === 'SUPERADMIN');

    if (!user || !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: SUPERADMIN access required' }, { status: 403 });
    }

    const results = {
      usersProcessed: 0,
      userRolesCreated: 0,
      userRolesExisted: 0,
      activeRolesSet: 0,
      errors: [] as string[],
      details: [] as any[],
    };

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

    for (const user of users) {
      const userDetail: any = {
        email: user.email,
        activeRole: user.activeRole,
        department: user.department?.name || 'None',
        userRolesCreated: [],
        status: 'success',
      };

      try {
        if (!user.departmentId) {
          userDetail.status = 'skipped';
          userDetail.reason = 'No department assigned';
          results.details.push(userDetail);
          continue;
        }

        results.usersProcessed++;

        // Create UserRole entry for active role if it doesn't exist
        if (user.activeRole) {
          try {
            const existingUserRole = await prisma.userRole.findUnique({
              where: {
                userId_role_departmentId: {
                  userId: user.id,
                  role: user.activeRole,
                  departmentId: user.departmentId,
                },
              },
            });

            if (existingUserRole) {
              results.userRolesExisted++;
              userDetail.userRolesCreated.push(`${user.activeRole} (existed)`);

              // Ensure it's set as active
              if (!user.activeUserRoleId) {
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    activeUserRoleId: existingUserRole.id,
                    updatedAt: new Date(),
                  },
                });
                results.activeRolesSet++;
                userDetail.activeRoleSet = true;
              }
            } else {
              const userRole = await prisma.userRole.create({
                data: {
                  id: crypto.randomUUID(),
                  userId: user.id,
                  role: user.activeRole,
                  departmentId: user.departmentId,
                  updatedAt: new Date(),
                },
              });
              results.userRolesCreated++;
              userDetail.userRolesCreated.push(`${user.activeRole} (created)`);

              // Set it as the active user role
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  activeUserRoleId: userRole.id,
                  updatedAt: new Date(),
                },
              });
              results.activeRolesSet++;
              userDetail.activeRoleSet = true;
            }
          } catch (error: any) {
            results.errors.push(`Error creating UserRole for ${user.email}, role ${user.activeRole}: ${error.message}`);
            userDetail.status = 'error';
            userDetail.error = error.message;
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
            results.activeRolesSet++;
            userDetail.activeRoleFixed = true;
          }
        }

        results.details.push(userDetail);
      } catch (error: any) {
        results.errors.push(`Error processing user ${user.email}: ${error.message}`);
        userDetail.status = 'error';
        userDetail.error = error.message;
        results.details.push(userDetail);
      }
    }

    // Get summary statistics
    const userRoleCount = await prisma.userRole.count();
    const uniqueUsers = await prisma.userRole.groupBy({
      by: ['userId'],
    });

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      summary: {
        totalUsers: users.length,
        usersProcessed: results.usersProcessed,
        userRolesCreated: results.userRolesCreated,
        userRolesExisted: results.userRolesExisted,
        activeRolesSet: results.activeRolesSet,
        totalUserRoles: userRoleCount,
        uniqueUsersWithRoles: uniqueUsers.length,
        errors: results.errors.length,
      },
      errors: results.errors,
      details: results.details,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
