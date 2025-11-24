import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get all currencies
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const activeOnly = searchParams.get('active') === 'true';

        const currencies = await prisma.currency.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: [
                { isBase: 'desc' },
                { code: 'asc' },
            ],
        });

        return NextResponse.json(currencies);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

// Create a new currency
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN and GLOBAL_ADMIN can create currencies
        if (!['SUPERADMIN', 'GLOBAL_ADMIN'].includes(session.user.role)) {
            return new NextResponse('Forbidden - Only SUPERADMIN or GLOBAL_ADMIN can manage currencies', { status: 403 });
        }

        const body = await req.json();
        const { code, name, symbol, isBase } = body;

        // Validate required fields
        if (!code || !name || !symbol) {
            return new NextResponse('Code, name, and symbol are required', { status: 400 });
        }

        // Check if currency code already exists
        const existing = await prisma.currency.findUnique({
            where: { code: code.toUpperCase() },
        });

        if (existing) {
            return new NextResponse('Currency code already exists', { status: 400 });
        }

        // If this is marked as base currency, unset other base currencies
        if (isBase) {
            await prisma.currency.updateMany({
                where: { isBase: true },
                data: { isBase: false },
            });
        }

        const currency = await prisma.currency.create({
            data: {
                code: code.toUpperCase(),
                name,
                symbol,
                isBase: isBase || false,
                isActive: true,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Currency',
                entityId: currency.id,
                afterData: currency as any,
            },
        });

        return NextResponse.json(currency);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
