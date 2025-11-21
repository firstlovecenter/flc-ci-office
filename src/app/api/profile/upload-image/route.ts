import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Configure route to handle file uploads
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return new NextResponse('No file provided', { status: 400 });
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            return new NextResponse('Invalid file type. Only images are allowed.', { status: 400 });
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return new NextResponse('File too large. Maximum size is 5MB.', { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), 'public', 'uploads', 'avatars');
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const filename = `${session.user.id}-${timestamp}.${fileExt}`;
        const filepath = join(uploadsDir, filename);

        // Save file
        await writeFile(filepath, buffer);

        // Return the URL path
        const imageUrl = `/uploads/avatars/${filename}`;

        return NextResponse.json({ 
            success: true, 
            url: imageUrl 
        });
    } catch (error) {
        console.error('Profile image upload error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
