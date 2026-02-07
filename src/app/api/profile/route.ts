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
                departmentId: true,
                department: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
                userRoles: {
                    include: {
                        department: {
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

        // Build update data based on user role
        const updateData: any = {
            name: name || undefined,
            image: image || undefined,
        };

        // Users can update their phone number
        if (phone) updateData.phone = phone;

        // Superadmins can update email (but not role)
        if (isSuperAdmin) {
            if (email) updateData.email = email;
        }

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
                departmentId: true,
                department: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'User',
                entityId: session.user.id,
                afterData: updatedUser as any,
            },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
