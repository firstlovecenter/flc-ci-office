import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { getDescendantOrganisationIds } from '@/lib/organisations';
import { validateRoleAssignment } from '@/lib/roleValidation';
import crypto from 'crypto';

// Force dynamic rendering - user list is role/organisation specific
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Only admins can list users
    // TODO: Add more granular checks
    if (!['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'].includes(session.user.role)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const availableOnly = searchParams.get('available') === 'true';
        
        let whereClause: any = {
            archived: false, // Only show non-archived users by default
        };

        // Determine which organisation to use for filtering
        // For users with multiple roles, use the activeUserRole's organisation
        let filterOrganisationId = session.user.organisationId;
        
        if (session.user.activeUserRole?.organisationId) {
            filterOrganisationId = session.user.activeUserRole.organisationId;
        }

        // For available users (leader selection), we want all registered users
        // that are not archived, regardless of their current organisation
        if (availableOnly) {
            // Get all non-archived users - they can be selected as leaders
            // Admins can see users that don't have roles yet, or users within their hierarchy
            if (session.user.role !== 'SUPERADMIN') {
                // Get users that are either:
                // 1. Have no organisation (unassigned users)
                // 2. Are in the admin's organisation hierarchy
                const allowedOrganisationIds = filterOrganisationId 
                    ? await getDescendantOrganisationIds(filterOrganisationId)
                    : [];
                    
                whereClause.OR = [
                    { organisationId: null },
                    { organisationId: { in: allowedOrganisationIds } },
                ];
            }
            // SUPERADMIN can see all users
        } else {
            // Filter users based on organisation hierarchy (original behavior)
            if (session.user.role !== 'SUPERADMIN') {
                if (filterOrganisationId) {
                    const allowedOrganisationIds = await getDescendantOrganisationIds(filterOrganisationId);
                    whereClause.organisationId = { in: allowedOrganisationIds };
                } else {
                    // User has no organisation, can't see any users
                    return NextResponse.json([]);
                }
            }
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            include: { organisation: true,
                baseCurrency: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        symbol: true,
                    },
                },
                userRoles: {
                    include: { organisation: {
                            select: {
                                id: true,
                                name: true,
                                level: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                name: 'asc',
            },
        });

        // Remove passwords from response
        const safeUsers = users.map(user => {
            const { password, ...rest } = user;
            return rest;
        });

        return NextResponse.json(safeUsers);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if user has admin role
    const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
    if (!adminRoles.includes(session.user.role)) {
        return new NextResponse('Forbidden - Admin role required', { status: 403 });
    }

    try {
        const body = await request.json();
        const { title, name, email, phone, roleOrganisationPairs } = body;

        // Validate required fields
        if (!phone?.trim()) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        // Validate required fields
        if (!phone?.trim()) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        // Users can now be created without roles initially
        const hasRoles = roleOrganisationPairs && roleOrganisationPairs.length > 0;
        
        // Extract unique roles for backward compatibility validation (only if roles provided)
        const userRoles: string[] = hasRoles ? Array.from(new Set(roleOrganisationPairs.map((pair: any) => pair.role as string))) : [];
        const firstDept = hasRoles ? roleOrganisationPairs[0].organisationId : null;

        // Validate role assignments only if roles are provided
        if (hasRoles) {
            const validation = await validateRoleAssignment('new-user', userRoles, firstDept, email);
            if (!validation.valid) {
                return NextResponse.json({ error: validation.error }, { status: 400 });
            }
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            return new NextResponse('User already exists', { status: 400 });
        }

        // For non-superadmins, verify they can create users in the target organisation
        if (session.user.role !== 'SUPERADMIN') {
            const filterOrganisationId = session.user.activeUserRole?.organisationId || session.user.organisationId;
            
            if (!filterOrganisationId) {
                return new NextResponse('Forbidden - No organisation assigned', { status: 403 });
            }

            // Get all organisations this admin oversees
            const allowedOrganisationIds = await getDescendantOrganisationIds(filterOrganisationId);
            
            // Verify all target organisations are within their scope
            for (const pair of roleOrganisationPairs) {
                if (!allowedOrganisationIds.includes(pair.organisationId)) {
                    return new NextResponse('Forbidden - Cannot create user in this organisation', { status: 403 });
                }
            }

            // Verify the role being assigned is appropriate for the admin's level
            // Admins can only assign roles at their level or below
            const userDept = firstDept ? await prisma.organisation.findUnique({ where: { id: firstDept } }) : null;
            const adminDept = await prisma.organisation.findUnique({ where: { id: filterOrganisationId } });
            
            if (userDept && adminDept) {
                const ORGANISATION_HIERARCHY: Record<string, number> = {
                    DENOMINATION: 1,
                    OVERSIGHT: 2,
                    CAMPUS: 3,
                    STREAM: 4,
                    COUNCIL: 5,
                };

                const userDeptLevel = userDept.level ? ORGANISATION_HIERARCHY[userDept.level] : 999;
                const adminDeptLevel = adminDept.level ? ORGANISATION_HIERARCHY[adminDept.level] : 999;

                // User organisation must be at admin's level or below
                if (userDeptLevel < adminDeptLevel) {
                    return new NextResponse('Forbidden - Cannot create user at higher organisation level', { status: 403 });
                }
            }
        }

        // Create the user with a random password (user will set via password reset email)
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const user = await prisma.user.create({
            data: {
                id: crypto.randomUUID(),
                title: title?.trim() || null,
                name,
                email: email.toLowerCase(),
                phone: phone.trim(),
                password: await bcrypt.hash(randomPassword, 10),
                activeRole: hasRoles ? (userRoles[0] as any) : null, // Keep for backward compatibility
                organisationId: firstDept, // Set to first organisation for backward compatibility
                updatedAt: new Date(),
            },
        });

        // Create UserRole entries for each role-organisation pair (only if roles provided)
        if (hasRoles && roleOrganisationPairs.length > 0) {
            await prisma.userRole.createMany({
                data: roleOrganisationPairs.map((pair: any) => ({
                    userId: user.id,
                    role: pair.role,
                    organisationId: pair.organisationId,
                })),
            });

            // Set the first UserRole as active
            const firstUserRole = await prisma.userRole.findFirst({
                where: {
                    userId: user.id,
                },
                orderBy: {
                    createdAt: 'asc',
                },
            });

            if (firstUserRole) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { activeUserRoleId: firstUserRole.id },
                });
            }
        }

        // Note: Password reset email will be sent when first role is assigned (in PUT /api/users/[id])

        const { password: _, ...safeUser } = user;

        return NextResponse.json(safeUser);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
