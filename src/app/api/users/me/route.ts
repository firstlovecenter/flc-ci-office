import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAppCurrency } from '@/lib/currency';

// Force dynamic rendering - data is user/role specific
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                organisation: {
                    include: {
                        parent: {
                            include: {
                                parent: {
                                    include: { parent: true },
                                },
                            },
                        },
                    },
                },
                activeUserRole: {
                    include: {
                        organisation: {
                            include: {
                                parent: {
                                    include: {
                                        parent: {
                                            include: { parent: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                userRoles: {
                    include: {
                        organisation: {
                            include: {
                                parent: {
                                    include: {
                                        parent: {
                                            include: { parent: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const baseCurrency = await getAppCurrency();

        return NextResponse.json({
            ...user,
            baseCurrency,
            activeUserRoleId: user.activeUserRoleId,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** Currency is hardcoded to GHS — PATCH no longer changes base currency. */
export async function PATCH(_request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseCurrency = await getAppCurrency();
    return NextResponse.json({
        message: 'Currency is fixed to Ghana Cedis (GHS). Base currency cannot be changed.',
        baseCurrency,
    });
}
