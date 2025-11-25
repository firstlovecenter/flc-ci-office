import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 60; // Revalidate every 60 seconds

// Get all exchange rates
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const exchangeRates = await prisma.exchangeRate.findMany({
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
            orderBy: {
                effectiveDate: 'desc',
            },
        });

        const response = NextResponse.json(exchangeRates);
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        return response;
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// Create or update an exchange rate
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN and GLOBAL_ADMIN can manage exchange rates
        if (!['SUPERADMIN', 'GLOBAL_ADMIN'].includes(session.user.role)) {
            return new NextResponse('Forbidden - Only SUPERADMIN or GLOBAL_ADMIN can manage exchange rates', { status: 403 });
        }

        const body = await req.json();
        const { fromCurrencyId, toCurrencyId, rate, effectiveDate } = body;

        // Validate required fields
        if (!fromCurrencyId || !toCurrencyId || !rate) {
            return new NextResponse('From currency, to currency, and rate are required', { status: 400 });
        }

        if (fromCurrencyId === toCurrencyId) {
            return new NextResponse('From and to currencies must be different', { status: 400 });
        }

        if (parseFloat(rate) <= 0) {
            return new NextResponse('Exchange rate must be greater than 0', { status: 400 });
        }

        // Check if both currencies exist
        const [fromCurrency, toCurrency] = await Promise.all([
            prisma.currency.findUnique({ where: { id: fromCurrencyId } }),
            prisma.currency.findUnique({ where: { id: toCurrencyId } }),
        ]);

        if (!fromCurrency || !toCurrency) {
            return new NextResponse('Invalid currency ID', { status: 400 });
        }

        // Check if exchange rate already exists
        const existing = await prisma.exchangeRate.findUnique({
            where: {
                fromCurrencyId_toCurrencyId: {
                    fromCurrencyId,
                    toCurrencyId,
                },
            },
        });

        let exchangeRate;
        if (existing) {
            // Update existing rate
            exchangeRate = await prisma.exchangeRate.update({
                where: { id: existing.id },
                data: {
                    rate,
                    effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
                    createdBy: session.user.id,
                },
                include: {
                    fromCurrency: true,
                    toCurrency: true,
                },
            });

            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    actionType: 'UPDATE',
                    entityType: 'ExchangeRate',
                    entityId: exchangeRate.id,
                    beforeData: existing as any,
                    afterData: exchangeRate as any,
                },
            });
        } else {
            // Create new rate
            exchangeRate = await prisma.exchangeRate.create({
                data: {
                    fromCurrencyId,
                    toCurrencyId,
                    rate,
                    effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
                    createdBy: session.user.id,
                },
                include: {
                    fromCurrency: true,
                    toCurrency: true,
                },
            });

            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    actionType: 'CREATE',
                    entityType: 'ExchangeRate',
                    entityId: exchangeRate.id,
                    afterData: exchangeRate as any,
                },
            });
        }

        return NextResponse.json(exchangeRate);
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
