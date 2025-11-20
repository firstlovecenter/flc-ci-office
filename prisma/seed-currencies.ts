import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('Seeding currencies...');

    // Create Ghana Cedis as base currency
    const ghs = await prisma.currency.upsert({
        where: { code: 'GHS' },
        update: {
            isBase: true,
            isActive: true,
        },
        create: {
            code: 'GHS',
            name: 'Ghana Cedis',
            symbol: '₵',
            isBase: true,
            isActive: true,
        },
    });

    console.log('Created/Updated Ghana Cedis:', ghs);

    // Create other common currencies
    const usd = await prisma.currency.upsert({
        where: { code: 'USD' },
        update: {},
        create: {
            code: 'USD',
            name: 'US Dollar',
            symbol: '$',
            isBase: false,
            isActive: true,
        },
    });

    const eur = await prisma.currency.upsert({
        where: { code: 'EUR' },
        update: {},
        create: {
            code: 'EUR',
            name: 'Euro',
            symbol: '€',
            isBase: false,
            isActive: true,
        },
    });

    const gbp = await prisma.currency.upsert({
        where: { code: 'GBP' },
        update: {},
        create: {
            code: 'GBP',
            name: 'British Pound',
            symbol: '£',
            isBase: false,
            isActive: true,
        },
    });

    console.log('Created common currencies:', { usd, eur, gbp });

    // Set example exchange rates (these should be updated regularly)
    const usdToGhs = await prisma.exchangeRate.upsert({
        where: {
            fromCurrencyId_toCurrencyId: {
                fromCurrencyId: usd.id,
                toCurrencyId: ghs.id,
            },
        },
        update: {
            rate: 16.50,
            effectiveDate: new Date(),
        },
        create: {
            fromCurrencyId: usd.id,
            toCurrencyId: ghs.id,
            rate: 16.50,
            effectiveDate: new Date(),
            createdBy: 'system',
        },
    });

    const eurToGhs = await prisma.exchangeRate.upsert({
        where: {
            fromCurrencyId_toCurrencyId: {
                fromCurrencyId: eur.id,
                toCurrencyId: ghs.id,
            },
        },
        update: {
            rate: 18.00,
            effectiveDate: new Date(),
        },
        create: {
            fromCurrencyId: eur.id,
            toCurrencyId: ghs.id,
            rate: 18.00,
            effectiveDate: new Date(),
            createdBy: 'system',
        },
    });

    const gbpToGhs = await prisma.exchangeRate.upsert({
        where: {
            fromCurrencyId_toCurrencyId: {
                fromCurrencyId: gbp.id,
                toCurrencyId: ghs.id,
            },
        },
        update: {
            rate: 20.50,
            effectiveDate: new Date(),
        },
        create: {
            fromCurrencyId: gbp.id,
            toCurrencyId: ghs.id,
            rate: 20.50,
            effectiveDate: new Date(),
            createdBy: 'system',
        },
    });

    console.log('Created exchange rates:', { usdToGhs, eurToGhs, gbpToGhs });

    console.log('Seeding completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
