import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { generateDepartmentAlertEmail } from '@/lib/email-templates/department-alert';

// This endpoint should be called by a cron job (e.g., daily at 8 AM)
// to check for department activity alerts

export async function POST(request: Request) {
  try {
    // Verify authorization (use a secret key for cron jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const alertResults = [];

    // Get all departments
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    // Define thresholds
    const HIGH_PENDING_THRESHOLD = 5; // Alert if more than 5 pending transactions
    const HIGH_PENDING_AMOUNT_THRESHOLD = 5000; // Alert if pending amount exceeds GHS 5,000
    const INACTIVITY_THRESHOLD_DAYS = 14; // Alert if no transactions in 14 days
    const BUDGET_THRESHOLD_PERCENTAGE = 85; // Alert if 85% of budget used (if budget tracking is implemented)

    const now = new Date();
    const inactivityDate = new Date();
    inactivityDate.setDate(now.getDate() - INACTIVITY_THRESHOLD_DAYS);

    for (const department of departments) {
      try {
        // Check for high pending transactions
        const pendingTransactions = await prisma.transaction.findMany({
          where: {
            departmentId: department.id,
            status: 'PENDING',
          },
        });

        const pendingCount = pendingTransactions.length;
        const pendingAmount = pendingTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.amount),
          0
        );

        if (
          pendingCount >= HIGH_PENDING_THRESHOLD ||
          pendingAmount >= HIGH_PENDING_AMOUNT_THRESHOLD
        ) {
          // Get department admins
          const admins = await getAdminsForDepartment(department.id);

          for (const admin of admins) {
            try {
              const emailContent = generateDepartmentAlertEmail({
                recipientName: admin.name || admin.email,
                departmentName: department.name,
                alertType: 'high-pending',
                details: {
                  pendingCount,
                  pendingAmount,
                },
                dashboardUrl: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard`,
              });

              await sendEmail({
                to: admin.email,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text,
              });

              alertResults.push({
                department: department.name,
                recipient: admin.email,
                alertType: 'high-pending',
                status: 'sent',
              });
            } catch (emailError) {
              console.error(
                `Failed to send high-pending alert to ${admin.email}:`,
                emailError
              );
              alertResults.push({
                department: department.name,
                recipient: admin.email,
                alertType: 'high-pending',
                status: 'failed',
                error: emailError instanceof Error ? emailError.message : 'Unknown error',
              });
            }
          }
        }

        // Check for low activity
        const recentTransactions = await prisma.transaction.findMany({
          where: {
            departmentId: department.id,
            createdAt: {
              gte: inactivityDate,
            },
          },
          take: 1,
        });

        if (recentTransactions.length === 0) {
          // No transactions in the last INACTIVITY_THRESHOLD_DAYS days
          const lastTransaction = await prisma.transaction.findFirst({
            where: {
              departmentId: department.id,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

          let daysInactive = INACTIVITY_THRESHOLD_DAYS;
          if (lastTransaction) {
            const daysSinceLastTransaction = Math.floor(
              (now.getTime() - new Date(lastTransaction.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            daysInactive = daysSinceLastTransaction;
          }

          // Get department admins
          const admins = await getAdminsForDepartment(department.id);

          for (const admin of admins) {
            try {
              const emailContent = generateDepartmentAlertEmail({
                recipientName: admin.name || admin.email,
                departmentName: department.name,
                alertType: 'low-activity',
                details: {
                  daysInactive,
                },
                dashboardUrl: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard`,
              });

              await sendEmail({
                to: admin.email,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text,
              });

              alertResults.push({
                department: department.name,
                recipient: admin.email,
                alertType: 'low-activity',
                status: 'sent',
              });
            } catch (emailError) {
              console.error(
                `Failed to send low-activity alert to ${admin.email}:`,
                emailError
              );
              alertResults.push({
                department: department.name,
                recipient: admin.email,
                alertType: 'low-activity',
                status: 'failed',
                error: emailError instanceof Error ? emailError.message : 'Unknown error',
              });
            }
          }
        }

        // Budget threshold alerts can be added here if budget tracking is implemented
        // For now, this is a placeholder for future enhancement

      } catch (deptError) {
        console.error(`Failed to process department ${department.name}:`, deptError);
        alertResults.push({
          department: department.name,
          status: 'failed',
          error: deptError instanceof Error ? deptError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      alertsChecked: new Date().toISOString(),
      results: alertResults,
    });
  } catch (error) {
    console.error('Error checking department alerts:', error);
    return NextResponse.json(
      { error: 'Failed to check department alerts' },
      { status: 500 }
    );
  }
}

// Helper function to get admins for a department
async function getAdminsForDepartment(departmentId: string) {
  // Get department-specific admins
  const departmentAdmins = await prisma.user.findMany({
    where: {
      departmentId: departmentId,
      archived: false,
      roles: {
        hasSome: [
          'SUPERADMIN',
          'GLOBAL_ADMIN',
          'INTERNATIONAL_ADMIN',
          'NATIONAL_ADMIN',
          'REGIONAL_ADMIN',
          'CAMPUS_ADMIN',
        ],
      },
    },
    select: {
      name: true,
      email: true,
    },
  });

  // Get SUPERADMIN users (they see all departments)
  const superAdmins = await prisma.user.findMany({
    where: {
      archived: false,
      roles: {
        has: 'SUPERADMIN',
      },
    },
    select: {
      name: true,
      email: true,
    },
  });

  // Combine and deduplicate
  const allAdmins = [...departmentAdmins, ...superAdmins];
  return Array.from(new Map(allAdmins.map(a => [a.email, a])).values());
}
