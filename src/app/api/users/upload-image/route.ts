import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { authorizeTargetUser, callerOrganisationId, loadTargetScope } from '@/lib/user-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
        if (!adminRoles.includes(session.user.role)) {
            return NextResponse.json({ error: 'Only admins can upload user images' }, { status: 403 });
        }

        let formData;
        try {
            formData = await req.formData();
        } catch {
            return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 });
        }

        const file = formData.get('file') as File;
        const userId = formData.get('userId') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        if (!userId) {
            return NextResponse.json({ error: 'No user ID provided' }, { status: 400 });
        }

        // Same authorisation as editing the user: known target, caller outranks
        // them over ALL their roles, every org inside the caller's subtree.
        // Self is always allowed; SUPERADMIN is exempt. Checked before uploading.
        const targetScope = await loadTargetScope(userId);
        if (!targetScope) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (userId !== session.user.id) {
            const decision = await authorizeTargetUser(
                { id: session.user.id, role: session.user.role, organisationId: callerOrganisationId(session) },
                targetScope,
                { requireHierarchy: true },
            );
            if (!decision.ok) {
                return NextResponse.json({ error: decision.error }, { status: decision.status });
            }
        }

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const uploadResult = await uploadToCloudinary(buffer, {
            folder: 'flc-accounts/avatars',
            public_id: `${userId}-${Date.now()}`,
            resource_type: 'image',
            transformation: [
                { width: 200, height: 200, crop: 'fill', gravity: 'face' },
                { quality: 'auto', fetch_format: 'auto' },
            ],
        });

        const imageUrl = uploadResult.secure_url;

        await prisma.user.update({
            where: { id: userId },
            data: { image: imageUrl },
        });

        return NextResponse.json({ success: true, url: imageUrl });
    } catch (error) {
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
