import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserBaseCurrency } from '@/lib/currency-conversion';
import { convertToUserBaseCurrency } from '@/lib/currency-conversion';
import { getDescendantDepartmentIds } from '@/lib/departments';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
        const whereClause: any = {};
        
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
                    ...whereClause,
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
        
        // A4 size: 595 x 842 points
        let page = pdfDoc.addPage([595, 842]);
        const { width, height } = page.getSize();
        
        let y = height - 50; // Start from top with 50pt margin

        // Helper function to add new page if needed
        const checkAndAddPage = () => {
            if (y < 100) { // Leave margin at bottom
                page = pdfDoc.addPage([595, 842]);
                y = height - 50;
                return true;
            }
            return false;
        };

        // Helper to draw centered text
        const drawCenteredText = (text: string, yPos: number, size: number, font_: any = font) => {
            const textWidth = font_.widthOfTextAtSize(text, size);
            page.drawText(text, {
                x: (width - textWidth) / 2,
                y: yPos,
                size,
                font: font_,
                color: rgb(0, 0, 0),
            });
        };

        // Helper to draw right-aligned text
        const drawRightText = (text: string, x: number, yPos: number, size: number) => {
            const textWidth = font.widthOfTextAtSize(text, size);
            page.drawText(text, {
                x: x - textWidth,
                y: yPos,
                size,
                font,
                color: rgb(0, 0, 0),
            });
        };

        // Header
        drawCenteredText('FLC CI Office', y, 20, boldFont);
        y -= 25;
        drawCenteredText('Bank Statement Report', y, 16, boldFont);
        y -= 20;
        drawCenteredText(departmentName, y, 10);
        y -= 15;
        drawCenteredText(`Currency: ${userBaseCurrency.code} (${userBaseCurrency.symbol})`, y, 9);
        y -= 15;
        
        if (startDate || endDate) {
            const startStr = startDate ? new Date(startDate).toLocaleDateString() : 'Start';
            const endStr = endDate ? new Date(endDate).toLocaleDateString() : 'Present';
            drawCenteredText(`Period: ${startStr} - ${endStr}`, y, 9);
            y -= 15;
        }
        
        y -= 20;

        // Opening Balance
        page.drawText(`Opening Balance: ${userBaseCurrency.symbol}${openingBalance.toFixed(2)}`, {
            x: 50,
            y,
            size: 11,
            font: boldFont,
            color: rgb(0, 0, 0),
        });
        y -= 30;

        // Table Header
        const tableTop = y;
        const colX = {
            date: 50,
            description: 120,
            department: 270,
            debit: 370,
            credit: 440,
            balance: 510,
        };

        page.drawText('Date', { x: colX.date, y: tableTop, size: 9, font: boldFont, color: rgb(0, 0, 0) });
        page.drawText('Description', { x: colX.description, y: tableTop, size: 9, font: boldFont, color: rgb(0, 0, 0) });
        page.drawText('Department', { x: colX.department, y: tableTop, size: 9, font: boldFont, color: rgb(0, 0, 0) });
        drawRightText('Debit', colX.debit + 70, tableTop, 9);
        drawRightText('Credit', colX.credit + 70, tableTop, 9);
        drawRightText('Balance', colX.balance + 70, tableTop, 9);

        // Draw line under header
        page.drawLine({
            start: { x: 50, y: tableTop - 5 },
            end: { x: 545, y: tableTop - 5 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
        
        y = tableTop - 20;
        let runningBalance = openingBalance;

        // Table Rows
        for (const tx of transactions) {
            // Check if we need a new page
            if (y < 100) {
                page = pdfDoc.addPage([595, 842]);
                y = height - 50;
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

            const dateStr = new Date(tx.createdAt).toLocaleDateString();
            let description = tx.description.substring(0, 30);
            
            // Add original currency info if different from base
            if (tx.currency && tx.currency.code !== userBaseCurrency.code) {
                description += ` (${tx.currency.symbol}${Number(tx.amount).toFixed(2)} ${tx.currency.code})`;
            }
            
            const deptName = tx.department.name.substring(0, 20);

            page.drawText(dateStr, { x: colX.date, y, size: 8, font, color: rgb(0, 0, 0) });
            page.drawText(description, { x: colX.description, y, size: 8, font, color: rgb(0, 0, 0) });
            page.drawText(deptName, { x: colX.department, y, size: 8, font, color: rgb(0, 0, 0) });
            drawRightText(debit ? `${userBaseCurrency.symbol}${debit.toFixed(2)}` : '-', colX.debit + 70, y, 8);
            drawRightText(credit ? `${userBaseCurrency.symbol}${credit.toFixed(2)}` : '-', colX.credit + 70, y, 8);
            drawRightText(`${userBaseCurrency.symbol}${runningBalance.toFixed(2)}`, colX.balance + 70, y, 8);

            y -= 20;
        }

        // Closing Balance
        y -= 30;
        checkAndAddPage();
        drawRightText(`Closing Balance: ${userBaseCurrency.symbol}${runningBalance.toFixed(2)}`, 545, y, 11);
        
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
        checkAndAddPage();
        page.drawText(`Total Income: ${userBaseCurrency.symbol}${income.toFixed(2)}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
        y -= 15;
        page.drawText(`Total Expense: ${userBaseCurrency.symbol}${expense.toFixed(2)}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
        y -= 15;
        page.drawText(`Net Change: ${userBaseCurrency.symbol}${(income - expense).toFixed(2)}`, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });

        // Footer
        const footerText = `Generated on ${new Date().toLocaleString()} by ${session.user.name || session.user.email}`;
        drawCenteredText(footerText, 50, 8);

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
        return NextResponse.json({ 
            error: 'Failed to generate PDF', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}
