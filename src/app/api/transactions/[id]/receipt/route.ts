import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToCloudinary, destroyCloudinaryAsset, publicIdFromCloudinaryUrl } from '@/lib/cloudinary';
import { hasOrganisationAccess } from '@/lib/organisations';
import { createAuditLog } from '@/lib/audit';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await context.params;

    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: { id: true, type: true, status: true, userId: true, organisationId: true, isCharge: true, receiptWaived: true },
    });

    if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.type !== 'EXPENSE') {
        return NextResponse.json({ error: 'Receipts can only be attached to expense transactions.' }, { status: 400 });
    }

    if (transaction.isCharge) {
        return NextResponse.json({ error: 'Transaction charges are system-generated fees and do not require a receipt.' }, { status: 400 });
    }

    if (transaction.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Receipts can only be attached after the expense has been approved.' }, { status: 400 });
    }

    if (transaction.receiptWaived) {
        return NextResponse.json({ error: 'Receipt requirement was waived for this transaction.' }, { status: 400 });
    }

    // The owner may always attach their own receipt. Admins (and SuperAdmin) may
    // attach receipts for any approved expense within their organisational scope.
    const isOwner = transaction.userId === session.user.id;
    const role = session.user.role;
    const isAdmin = role === 'SUPERADMIN' || (typeof role === 'string' && role.endsWith('_ADMIN'));
    const hasScopedAccess = isAdmin
        ? await hasOrganisationAccess(
              { role, organisationId: session.user.organisationId },
              transaction.organisationId,
          )
        : false;

    if (!isOwner && !hasScopedAccess) {
        return NextResponse.json(
            { error: 'You do not have permission to attach a receipt to this transaction.' },
            { status: 403 },
        );
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME.includes(file.type)) {
        return NextResponse.json(
            { error: 'Invalid file type. Allowed: JPG, PNG, WEBP, PDF.' },
            { status: 400 },
        );
    }

    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let secureUrl: string;
    try {
        const uploadResult = await uploadToCloudinary(buffer, {
            folder: 'flc-accounts/receipts',
            public_id: `${transactionId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            resource_type: 'auto',
        });
        secureUrl = uploadResult.secure_url;
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to upload to storage.' },
            { status: 500 },
        );
    }

    try {
        const created = await prisma.file.create({
            data: {
                id: crypto.randomUUID(),
                transactionId,
                fileName: file.name,
                fileUrl: secureUrl,
                fileMime: file.type,
                fileSize: file.size,
                uploadedBy: session.user.id,
            },
            include: {
                uploader: { select: { id: true, name: true, email: true } },
            },
        });

        await createAuditLog({
            userId: session.user.id,
            actionType: 'FILE_UPLOAD',
            entityType: 'Transaction',
            entityId: transactionId,
            description: `Uploaded receipt for transaction`,
            metadata: { fileName: file.name, fileSize: file.size, fileMime: file.type },
        });

        return NextResponse.json(created, { status: 201 });
    } catch (err: any) {
        const publicId = publicIdFromCloudinaryUrl(secureUrl);
        if (publicId) {
            await destroyCloudinaryAsset(publicId, {
                resource_type: 'image',
            }).catch(() => {});
        }
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to save receipt.' },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Only a SuperAdmin can remove a receipt.' }, { status: 403 });
    }

    const { id: transactionId } = await context.params;

    const existing = await prisma.file.findMany({
        where: { transactionId },
    });

    if (!existing.length) {
        return NextResponse.json({ error: 'No receipt attached to this transaction.' }, { status: 404 });
    }

    for (const file of existing) {
        const publicId = publicIdFromCloudinaryUrl(file.fileUrl);
        if (publicId) {
            await destroyCloudinaryAsset(publicId).catch(() => {});
        }
    }

    await prisma.file.deleteMany({ where: { transactionId } });

    await createAuditLog({
        userId: session.user.id,
        actionType: 'DELETE',
        entityType: 'Transaction',
        entityId: transactionId,
        description: `Removed receipt(s) from transaction`,
        metadata: { count: existing.length, files: existing.map((f) => f.fileName) },
        severity: 'CRITICAL',
    });

    return NextResponse.json({ success: true });
}
