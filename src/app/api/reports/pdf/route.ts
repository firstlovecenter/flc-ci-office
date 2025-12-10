import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserBaseCurrency } from '@/lib/currency-conversion';
import { convertToUserBaseCurrency } from '@/lib/currency-conversion';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatCurrency, formatNumber } from '@/lib/utils';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('Failed to parse request body:', parseError);
            return NextResponse.json({ 
                error: 'Invalid request body',
                details: 'Request body must be valid JSON'
            }, { status: 400 });
        }

        const { departmentId, startDate, endDate, reportType, includeSubDepartments = true } = body;

        // Get user's base currency
        const userBaseCurrency = await getUserBaseCurrency(session.user.id);
        if (!userBaseCurrency) {
            return NextResponse.json({ error: 'Base currency not found' }, { status: 500 });
        }

        // Get all exchange rates for conversion
        const exchangeRates = await prisma.exchangeRate.findMany({
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
        });

        // Fetch transactions
        const whereClause: any = {
            status: 'APPROVED',
        };
        
        if (departmentId) {
            // Handle exact vs hierarchical department filtering
            if (includeSubDepartments) {
                // Get all descendant departments
                const descendantIds = await getDescendantDepartmentIds(departmentId);
                whereClause.departmentId = { in: descendantIds };
            } else {
                // Only exact department match
                whereClause.departmentId = departmentId;
            }
        }
        
        if (startDate && endDate) {
            whereClause.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        } else if (startDate) {
            whereClause.createdAt = { gte: new Date(startDate) };
        } else if (endDate) {
            whereClause.createdAt = { lte: new Date(endDate) };
        }

        const transactions = await prisma.transaction.findMany({
            where: whereClause,
            include: {
                department: true,
                user: true,
                currency: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Calculate opening balance (transactions before start date) with conversion
        let openingBalance = 0;
        if (startDate) {
            const priorTransactions = await prisma.transaction.findMany({
                where: {
                    status: 'APPROVED',
                    ...(departmentId && includeSubDepartments 
                        ? { departmentId: { in: await getDescendantDepartmentIds(departmentId) } }
                        : departmentId ? { departmentId } : {}),
                    createdAt: { lt: new Date(startDate) },
                },
                include: {
                    currency: true,
                },
            });
            
            priorTransactions.forEach(tx => {
                const amount = convertToUserBaseCurrency(
                    Number(tx.amount),
                    tx.currencyId || userBaseCurrency.id,
                    userBaseCurrency.id,
                    exchangeRates
                );
                if (tx.type === 'INCOME') {
                    openingBalance += amount;
                } else {
                    openingBalance -= amount;
                }
            });
        }

        // Get department name
        let departmentName = 'All Departments';
        if (departmentId) {
            const dept = await prisma.department.findUnique({
                where: { id: departmentId },
            });
            if (dept) departmentName = dept.name;
        }

        // Create PDF document using pdf-lib (serverless-compatible)
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // Helper to handle currency symbols that aren't supported by WinAnsi encoding (like Cedi)
        const getSafeSymbol = (symbol: string, code: string) => {
            // WinAnsi encoding doesn't support Cedi symbol (₵)
            if (symbol.includes('₵') || code === 'GHS') return 'GHS ';
            return symbol.replace(/₵/g, 'GHS');
        };

        // Sanitize text to remove/replace characters not supported by WinAnsi encoding
        const sanitizeText = (text: string) => {
            if (!text) return '';
            return text
                .replace(/₵/g, 'GHS')
                .replace(/→/g, '->')
                .replace(/←/g, '<-')
                .replace(/↑/g, '^')
                .replace(/↓/g, 'v')
                .replace(/•/g, '-')
                .replace(/…/g, '...')
                .replace(/–/g, '-')
                .replace(/—/g, '-')
                .replace(/'/g, "'")
                .replace(/'/g, "'")
                .replace(/"/g, '"')
                .replace(/"/g, '"')
                .replace(/€/g, 'EUR')
                .replace(/£/g, 'GBP')
                .replace(/¥/g, 'JPY')
                .replace(/₹/g, 'INR')
                .replace(/[^\x00-\xFF]/g, ''); // Remove any other non-WinAnsi characters
        };

        const safeCurrencySymbol = getSafeSymbol(userBaseCurrency.symbol, userBaseCurrency.code);

        // A4 size: 595 x 842 points
        let page = pdfDoc.addPage([595, 842]);
        const { width, height } = page.getSize();
        
        let y = height - 50; // Start from top with 50pt margin

        // Helper to draw centered text
        const drawCenteredText = (text: string, yPos: number, size: number, useFont: any) => {
            const safeText = sanitizeText(text);
            const textWidth = useFont.widthOfTextAtSize(safeText, size);
            page.drawText(safeText, {
                x: (width - textWidth) / 2,
                y: yPos,
                size,
                font: useFont,
                color: rgb(0, 0, 0),
            });
        };

        // Helper to draw right-aligned text
        const drawRightText = (text: string, x: number, yPos: number, size: number) => {
            const safeText = sanitizeText(text);
            const textWidth = font.widthOfTextAtSize(safeText, size);
            page.drawText(safeText, {
                x: x - textWidth,
                y: yPos,
                size,
                font,
                color: rgb(0, 0, 0),
            });
        };

        // Helper to wrap text
        const wrapText = (text: string, maxWidth: number, fontSize: number) => {
            if (!text) return [''];
            
            // Sanitize the text first
            const safeText = sanitizeText(text);
            const words = safeText.split(' ');
            const lines: string[] = [];
            let currentLine = words[0] || '';

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = font.widthOfTextAtSize(currentLine + ' ' + word, fontSize);
                if (width < maxWidth) {
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        // Header
        drawCenteredText('FLC CI Office', y, 20, boldFont);
        y -= 25;
        drawCenteredText('Bank Statement Report', y, 16, boldFont);
        y -= 20;
        drawCenteredText(sanitizeText(departmentName), y, 10, font);
        y -= 15;
        drawCenteredText(`Currency: ${userBaseCurrency.code} (${safeCurrencySymbol})`, y, 9, font);
        y -= 15;
        
        if (startDate || endDate) {
            const startStr = startDate ? new Date(startDate).toLocaleDateString() : 'Start';
            const endStr = endDate ? new Date(endDate).toLocaleDateString() : 'Present';
            drawCenteredText(`Period: ${startStr} - ${endStr}`, y, 9, font);
            y -= 15;
        }
        
        y -= 20;

        // Opening Balance
        page.drawText(`Opening Balance: ${safeCurrencySymbol}${formatNumber(openingBalance)}`, {
            x: 50,
            y,
            size: 11,
            font: boldFont,
            color: rgb(0, 0, 0),
        });
        y -= 30;

        // Column positions
        const colX = {
            date: 50,
            description: 120,
            department: 270,
            debit: 370,
            credit: 440,
            balance: 510,
        };

        // Helper to draw table header on current page
        const drawTableHeader = (yPos: number) => {
            page.drawText('Date', { x: colX.date, y: yPos, size: 9, font: boldFont, color: rgb(0, 0, 0) });
            page.drawText('Description', { x: colX.description, y: yPos, size: 9, font: boldFont, color: rgb(0, 0, 0) });
            page.drawText('Department', { x: colX.department, y: yPos, size: 9, font: boldFont, color: rgb(0, 0, 0) });
            drawRightText('Debit', colX.debit + 70, yPos, 9);
            drawRightText('Credit', colX.credit + 70, yPos, 9);
            drawRightText('Balance', colX.balance + 70, yPos, 9);

            // Draw line under header
            page.drawLine({
                start: { x: 50, y: yPos - 5 },
                end: { x: 545, y: yPos - 5 },
                thickness: 1,
                color: rgb(0, 0, 0),
            });
            
            return yPos - 20; // Return new y position after header
        };

        // Draw initial table header
        y = drawTableHeader(y);
        let runningBalance = openingBalance;

        // Table Rows
        for (const tx of transactions) {
            const dateStr = new Date(tx.createdAt).toLocaleDateString();
            let description = sanitizeText(tx.description);
            
            // Add original currency info if different from base
            if (tx.currency && tx.currency.code !== userBaseCurrency.code) {
                const txSafeSymbol = getSafeSymbol(tx.currency.symbol, tx.currency.code);
                description += ` (${txSafeSymbol}${formatNumber(Number(tx.amount))} ${tx.currency.code})`;
            }
            
            const deptName = sanitizeText(tx.department.name.substring(0, 20));

            // Calculate row height based on wrapped description
            const descriptionLines = wrapText(description, 140, 8);
            const lineHeight = 10;
            const rowHeight = Math.max(20, descriptionLines.length * lineHeight + 5);

            // Check if we need a new page
            if (y < 50 + rowHeight) {
                page = pdfDoc.addPage([595, 842]);
                y = height - 50;
                // Redraw table header on new page
                y = drawTableHeader(y);
            }

            // Convert amount to user's base currency
            const convertedAmount = convertToUserBaseCurrency(
                Number(tx.amount),
                tx.currencyId || userBaseCurrency.id,
                userBaseCurrency.id,
                exchangeRates
            );

            const debit = tx.type === 'EXPENSE' ? convertedAmount : 0;
            const credit = tx.type === 'INCOME' ? convertedAmount : 0;
            runningBalance += credit - debit;

            page.drawText(dateStr, { x: colX.date, y, size: 8, font, color: rgb(0, 0, 0) });
            
            // Draw wrapped description
            descriptionLines.forEach((line, i) => {
                page.drawText(line, { x: colX.description, y: y - (i * lineHeight), size: 8, font, color: rgb(0, 0, 0) });
            });

            page.drawText(deptName, { x: colX.department, y, size: 8, font, color: rgb(0, 0, 0) });
            drawRightText(debit ? `${safeCurrencySymbol}${formatNumber(debit)}` : '-', colX.debit + 70, y, 8);
            drawRightText(credit ? `${safeCurrencySymbol}${formatNumber(credit)}` : '-', colX.credit + 70, y, 8);
            drawRightText(`${safeCurrencySymbol}${formatNumber(runningBalance)}`, colX.balance + 70, y, 8);

            y -= rowHeight;
        }

        // Closing Balance
        y -= 30;
        if (y < 100) {
            page = pdfDoc.addPage([595, 842]);
            y = height - 50;
        }
        drawRightText(`Closing Balance: ${safeCurrencySymbol}${formatNumber(runningBalance)}`, 545, y, 11);
        
        // Summary
        const income = transactions
            .filter(t => t.type === 'INCOME')
            .reduce((sum, t) => {
                const converted = convertToUserBaseCurrency(
                    Number(t.amount),
                    t.currencyId || userBaseCurrency.id,
                    userBaseCurrency.id,
                    exchangeRates
                );
                return sum + converted;
            }, 0);
        const expense = transactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => {
                const converted = convertToUserBaseCurrency(
                    Number(t.amount),
                    t.currencyId || userBaseCurrency.id,
                    userBaseCurrency.id,
                    exchangeRates
                );
                return sum + converted;
            }, 0);

        y -= 30;
        // Check if we need a new page for summary
        if (y < 100) {
            page = pdfDoc.addPage([595, 842]);
            y = height - 50;
        }
        page.drawText(`Total Income: ${safeCurrencySymbol}${formatNumber(income)}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
        y -= 15;
        page.drawText(`Total Expense: ${safeCurrencySymbol}${formatNumber(expense)}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
        y -= 15;
        page.drawText(`Net Change: ${safeCurrencySymbol}${formatNumber(income - expense)}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });

        // Footer
        const footerText = `Generated on ${new Date().toLocaleString()} by ${sanitizeText(session.user.name || session.user.email || 'Unknown User')}`;
        drawCenteredText(footerText, 50, 8, font);

        // Generate PDF bytes
        const pdfBytes = await pdfDoc.save();
        
        // Convert to ArrayBuffer for Response
        const buffer = pdfBytes.buffer.slice(
            pdfBytes.byteOffset,
            pdfBytes.byteOffset + pdfBytes.byteLength
        ) as ArrayBuffer;

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="statement-report-${new Date().toISOString().split('T')[0]}.pdf"`,
            },
        });
    } catch (error) {
        console.error('PDF generation error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return NextResponse.json({ 
            error: 'Failed to generate PDF', 
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
