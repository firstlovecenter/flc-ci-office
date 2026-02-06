import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/base-currencies - List all oversight departments and their base currencies
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPERADMIN or DENOMINATION_ADMIN can view all base currencies
    if (session.user.role !== 'SUPERADMIN' && session.user.role !== 'DENOMINATION_ADMIN') {
      return NextResponse.json(
        { error: 'Only super admins can view all base currencies' },
        { status: 403 }
      );
    }

    // Get all oversight-level departments
    const oversightDepts = await prisma.department.findMany({
      where: {
        level: 'OVERSIGHT',
      },
      include: {
        departmentBaseCurrency: {
          include: {
            currency: true,
            setByUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get system base currency as fallback
    const systemBase = await prisma.currency.findFirst({
      where: { isBase: true },
    });

    const result = oversightDepts.map((dept) => ({
      departmentId: dept.id,
      departmentName: dept.name,
      baseCurrency: dept.departmentBaseCurrency?.currency
        ? {
            id: dept.departmentBaseCurrency.currency.id,
            code: dept.departmentBaseCurrency.currency.code,
            name: dept.departmentBaseCurrency.currency.name,
            symbol: dept.departmentBaseCurrency.currency.symbol,
          }
        : systemBase
        ? {
            id: systemBase.id,
            code: systemBase.code,
            name: systemBase.name,
            symbol: systemBase.symbol,
          }
        : null,
      isCustom: !!dept.departmentBaseCurrency,
      setBy: dept.departmentBaseCurrency?.setByUser
        ? {
            name: dept.departmentBaseCurrency.setByUser.name,
            email: dept.departmentBaseCurrency.setByUser.email,
          }
        : null,
      setAt: dept.departmentBaseCurrency?.updatedAt,
    }));

    return NextResponse.json({
      oversightDepartments: result,
      systemBase: systemBase
        ? {
            code: systemBase.code,
            name: systemBase.name,
            symbol: systemBase.symbol,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch base currencies' },
      { status: 500 }
    );
  }
}

// POST /api/admin/base-currencies - Initialize base currencies for all oversight departments
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPERADMIN can initialize base currencies
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Only super admins can initialize base currencies' },
        { status: 403 }
      );
    }

    const { departmentId, currencyId } = await req.json();

    if (!departmentId || !currencyId) {
      return NextResponse.json(
        { error: 'departmentId and currencyId are required' },
        { status: 400 }
      );
    }

    // Verify department exists and is OVERSIGHT level
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (department.level !== 'OVERSIGHT') {
      return NextResponse.json(
        { error: 'Only OVERSIGHT-level departments can have base currencies set' },
        { status: 400 }
      );
    }

    // Verify currency exists
    const currency = await prisma.currency.findUnique({
      where: { id: currencyId },
    });

    if (!currency) {
      return NextResponse.json({ error: 'Currency not found' }, { status: 404 });
    }

    // Upsert department base currency
    const deptBaseCurrency = await prisma.departmentBaseCurrency.upsert({
      where: { departmentId },
      create: {
        departmentId,
        currencyId,
        setBy: session.user.id,
      },
      update: {
        currencyId,
        setBy: session.user.id,
      },
      include: {
        currency: true,
      },
    });

    return NextResponse.json({
      message: 'Base currency set successfully',
      departmentBaseCurrency: deptBaseCurrency,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to set base currency' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/base-currencies - Delete a custom base currency for an oversight department
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPERADMIN can delete base currencies
    if (session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Only super admins can delete base currencies' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return NextResponse.json(
        { error: 'departmentId is required' },
        { status: 400 }
      );
    }

    // Verify department exists and is OVERSIGHT level
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (department.level !== 'OVERSIGHT') {
      return NextResponse.json(
        { error: 'Only OVERSIGHT-level departments can have base currencies' },
        { status: 400 }
      );
    }

    // Delete the department base currency (will revert to system default)
    await prisma.departmentBaseCurrency.deleteMany({
      where: { departmentId },
    });

    return NextResponse.json({
      message: 'Base currency deleted successfully. Department will now use system default.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete base currency' },
      { status: 500 }
    );
  }
}
