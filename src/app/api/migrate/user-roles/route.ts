import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check if user is authenticated and is a SUPERADMIN
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !user.roles.includes('SUPERADMIN')) {
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
      },
    });

    for (const user of users) {
      const userDetail: any = {
        email: user.email,
        roles: user.roles,
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

        // Create UserRole entries for each role the user has
        for (const role of user.roles) {
          try {
            const existingUserRole = await prisma.userRole.findUnique({
              where: {
                userId_role_departmentId: {
                  userId: user.id,
                  role: role,
                  departmentId: user.departmentId,
                },
              },
            });

            if (existingUserRole) {
              results.userRolesExisted++;
              userDetail.userRolesCreated.push(`${role} (existed)`);

              // If this is the active role, ensure it's set
              if (role === user.activeRole && !user.activeUserRoleId) {
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    activeUserRoleId: existingUserRole.id,
                  },
                });
                results.activeRolesSet++;
                userDetail.activeRoleSet = true;
              }
            } else {
              const userRole = await prisma.userRole.create({
                data: {
                  userId: user.id,
                  role: role,
                  departmentId: user.departmentId,
                },
              });
              results.userRolesCreated++;
              userDetail.userRolesCreated.push(`${role} (created)`);

              // If this is the active role, set it as the active user role
              if (role === user.activeRole) {
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    activeUserRoleId: userRole.id,
                  },
                });
                results.activeRolesSet++;
                userDetail.activeRoleSet = true;
              }
            }
          } catch (error: any) {
            results.errors.push(`Error creating UserRole for ${user.email}, role ${role}: ${error.message}`);
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
