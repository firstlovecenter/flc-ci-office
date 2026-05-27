import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

const AUTH_API_URL = process.env.AUTH_API_URL;
const AUTH_API_KEY = process.env.AUTH_API_KEY;

/**
 * Password reset is owned by the auth lambda. This route proxies the request
 * to the lambda's POST /forgot-password (which sends its own reset link) and
 * relays the response. The lambda only accepts email addresses.
 *
 * The client still posts `{ identifier }`; we forward it as `{ email }`.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 requests per 15 minutes per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`forgot-password:${ip}`, rateLimits.forgotPassword);
    if (!rl.success) {
      return rateLimitResponse(rl);
    }

    const { identifier } = await request.json();

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const email = identifier.toLowerCase().trim();

    // The lambda is email-only — phone-based reset is no longer supported.
    if (!email.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter the email address associated with your account.' },
        { status: 400 }
      );
    }

    if (!AUTH_API_URL) {
      console.error('AUTH_API_URL is not configured');
      return NextResponse.json(
        { error: 'An error occurred while processing your request' },
        { status: 500 }
      );
    }

    const res = await fetch(`${AUTH_API_URL}/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_API_KEY ? { 'x-api-key': AUTH_API_KEY } : {}),
      },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // Don't leak lambda internals; relay a generic message.
      return NextResponse.json(
        { error: data?.error || 'An error occurred while processing your request' },
        { status: res.status }
      );
    }

    // Lambda returns a non-enumerating success message; relay it.
    return NextResponse.json({
      message:
        data?.message ||
        'If an account exists with this email, password reset instructions have been sent.',
    });
  } catch (error) {
    console.error('Forgot-password proxy failed:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
