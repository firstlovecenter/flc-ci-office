import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// Get user profile
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                title: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                activeRole: true,
                archived: true,
                organisationId: true,
                organisation: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
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
                auditLogs: {
                    select: {
                        id: true,
                        actionType: true,
                        description: true,
                        timestamp: true,
                        ipAddress: true,
                    },
                    orderBy: {
                        timestamp: 'desc',
                    },
                    take: 50,
                },
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return new NextResponse('User not found', { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// Update user profile
export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const { name, image, email, phone } = body;

        const isSuperAdmin = session.user.role === 'SUPERADMIN';

        // Input validation
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
                return NextResponse.json({ error: 'Name must be between 1 and 100 characters' }, { status: 400 });
            }
        }

        if (phone !== undefined && phone !== null && phone !== '') {
            const phoneStr = String(phone).trim();
            if (!/^[+]?[\d\s-]{7,20}$/.test(phoneStr)) {
                return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
            }
        }

        if (image !== undefined && image !== null && image !== '') {
            const imageStr = String(image);
            if (!imageStr.startsWith('https://') || imageStr.length > 500) {
                return NextResponse.json({ error: 'Image must be a valid HTTPS URL' }, { status: 400 });
            }
        }

        // Build update data based on user role
        const updateData: any = {};
        if (name) updateData.name = name.trim();
        if (image) updateData.image = image;

        // Users can update their phone number
        if (phone) updateData.phone = String(phone).trim();

        // Superadmins can update email (but not role)
        if (isSuperAdmin && email) {
            // Check email uniqueness
            const existingUser = await prisma.user.findFirst({
                where: { email, id: { not: session.user.id } },
            });
            if (existingUser) {
                return NextResponse.json({ error: 'Email already in use by another user' }, { status: 400 });
            }
            updateData.email = email;
        }

        // Fetch current user data for audit beforeData
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { name: true, email: true, phone: true, image: true },
        });

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                activeRole: true,
                organisationId: true,
                organisation: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
            },
        });

        // Create audit log with before/after data
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'User',
                entityId: session.user.id,
                beforeData: currentUser as any,
                afterData: updatedUser as any,
            },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
