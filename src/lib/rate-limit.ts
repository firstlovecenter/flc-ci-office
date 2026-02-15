/**
 * In-memory rate limiter for API route protection.
 * Uses a sliding window approach with automatic cleanup.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  // Allow process to exit even if interval is running
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

startCleanup();

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (e.g., IP address, user ID, or combination).
 * Returns whether the request should be allowed.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true, remaining: config.maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimits = {
  /** Login: 5 attempts per 15 minutes per IP */
  login: { maxRequests: 5, windowSeconds: 15 * 60 },
  /** Forgot password: 3 requests per 15 minutes per IP */
  forgotPassword: { maxRequests: 3, windowSeconds: 15 * 60 },
  /** Reset password: 5 attempts per 15 minutes per IP */
  resetPassword: { maxRequests: 5, windowSeconds: 15 * 60 },
  /** General API: 100 requests per minute per IP */
  api: { maxRequests: 100, windowSeconds: 60 },
  /** SMS: 3 requests per hour per IP */
  sms: { maxRequests: 3, windowSeconds: 60 * 60 },
} as const;

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for, x-real-ip, then falls back to 'unknown'.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

/**
 * Create a rate limit error response with appropriate headers.
 */
export function rateLimitResponse(result: RateLimitResult) {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
      },
    },
  );
}
