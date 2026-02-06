import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Comprehensive list of world currencies
const currencies = [
    // Major currencies
    { code: 'USD', name: 'US Dollar', symbol: '$', isBase: true },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound Sterling', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
    
    // African currencies
    { code: 'GHS', name: 'Ghana Cedi', symbol: '₵' },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
    { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD' },
    { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
    { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
    { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br' },
    { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA' },
    { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA' },
    { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK' },
    { code: 'BWP', name: 'Botswana Pula', symbol: 'P' },
    { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK' },
    { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨' },
    { code: 'RWF', name: 'Rwandan Franc', symbol: 'RF' },
    { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz' },
    { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT' },
    
    // Asian currencies
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
    { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
    { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
    { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
    { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
    { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
    { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
    
    // European currencies (non-Euro)
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
    { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
    { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
    { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
    
    // Latin American currencies
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
    { code: 'ARS', name: 'Argentine Peso', symbol: '$' },
    { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
    { code: 'COP', name: 'Colombian Peso', symbol: '$' },
    { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/' },
    { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs.' },
    { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U' },
    { code: 'PYG', name: 'Paraguayan Guaraní', symbol: '₲' },
    { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs.' },
    
    // Caribbean currencies
    { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$' },
    { code: 'TTD', name: 'Trinidad and Tobago Dollar', symbol: 'TT$' },
    { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$' },
    { code: 'BSD', name: 'Bahamian Dollar', symbol: 'B$' },
    { code: 'XCD', name: 'East Caribbean Dollar', symbol: 'EC$' },
    
    // Pacific currencies
    { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$' },
    { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K' },
    { code: 'WST', name: 'Samoan Tala', symbol: 'WS$' },
    { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$' },
    
    // Other currencies
    { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr' },
    { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
    { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn' },
    { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин' },
    { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден' },
    { code: 'ALL', name: 'Albanian Lek', symbol: 'L' },
    { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM' },
    { code: 'GEL', name: 'Georgian Lari', symbol: '₾' },
    { code: 'AMD', name: 'Armenian Dram', symbol: '֏' },
    { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼' },
    { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br' },
    { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸' },
    { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm' },
    { code: 'KGS', name: 'Kyrgyzstani Som', symbol: 'с' },
    { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'ЅМ' },
    { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'm' },
    { code: 'AFN', name: 'Afghan Afghani', symbol: '؋' },
    { code: 'IRR', name: 'Iranian Rial', symbol: '﷼' },
    { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د' },
    { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا' },
    { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل' },
    { code: 'SYP', name: 'Syrian Pound', symbol: '£S' },
    { code: 'YER', name: 'Yemeni Rial', symbol: '﷼' },
    { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.' },
    { code: 'BHD', name: 'Bahraini Dinar', symbol: 'ب.د' },
];

async function main() {
    console.log('🌍 Starting comprehensive currency seeding...\n');

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const currency of currencies) {
        try {
            const result = await prisma.currency.upsert({
                where: { code: currency.code },
                update: {
                    name: currency.name,
                    symbol: currency.symbol,
                    isActive: true,
                },
                create: {
                    code: currency.code,
                    name: currency.name,
                    symbol: currency.symbol,
                    isBase: currency.isBase || false,
                    isActive: true,
                },
            });

            // Check if this was a creation or update
            const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
            if (isNew) {
                created++;
                console.log(`✅ Created: ${currency.code} - ${currency.name}`);
            } else {
                updated++;
                console.log(`🔄 Updated: ${currency.code} - ${currency.name}`);
            }
        } catch (error) {
            errors++;
            console.error(`❌ Error with ${currency.code}:`, error);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Total currencies: ${currencies.length}`);
    console.log(`   ✅ Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('='.repeat(50) + '\n');

    // Verify base currency exists
    const baseCurrency = await prisma.currency.findFirst({
        where: { isBase: true },
    });

    if (baseCurrency) {
        console.log(`✅ Base currency set to: ${baseCurrency.code} - ${baseCurrency.name}`);
    } else {
        console.warn('⚠️  Warning: No base currency set!');
    }

    console.log('\n✨ Currency seeding completed!\n');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('Fatal error:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
