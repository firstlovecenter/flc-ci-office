import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';

let configured = false;

function ensureConfigured() {
    if (configured) return;
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud_name || !api_key || !api_secret) {
        throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
    }
    cloudinary.config({ cloud_name, api_key, api_secret });
    configured = true;
}

/**
 * Upload a buffer to Cloudinary.
 *
 * Throws if Cloudinary credentials are missing — callers should catch and
 * translate to an HTTP 500 with a friendly message.
 */
export async function uploadToCloudinary(
    buffer: Buffer,
    options: UploadApiOptions,
): Promise<UploadApiResponse> {
    ensureConfigured();
    return new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(options, (error, result) => {
                if (error) reject(error);
                else if (!result) reject(new Error('Cloudinary returned no result'));
                else resolve(result);
            })
            .end(buffer);
    });
}

/**
 * Delete an asset from Cloudinary by its public_id.
 */
export async function destroyCloudinaryAsset(
    publicId: string,
    options: { resource_type?: 'image' | 'video' | 'raw' } = {},
): Promise<void> {
    ensureConfigured();
    await cloudinary.uploader.destroy(publicId, {
        resource_type: options.resource_type ?? 'image',
        invalidate: true,
    });
}

/**
 * Extract the Cloudinary `public_id` (folder + filename without extension)
 * from a `secure_url`. Used for delete operations where we only stored the URL.
 *
 * Example: "https://res.cloudinary.com/dpmfbsdd6/image/upload/v123/flc-accounts/receipts/abc-123.jpg"
 *   -> "flc-accounts/receipts/abc-123"
 *
 * Returns null if the URL doesn't match the expected Cloudinary pattern.
 */
export function publicIdFromCloudinaryUrl(url: string): string | null {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    return match ? match[1] : null;
}
