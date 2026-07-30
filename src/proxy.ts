import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/api/auth',
  '/offline',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
  '/public-expense',
  '/api/public-expense/campuses',
  '/api/public-expense/oversights',
  '/api/public-expense',
];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(path => pathname.startsWith(path));
}

/**
 * Validate that mutating requests originate from the same site.
 * Checks the Origin header (preferred) and falls back to Referer.
 * Returns true if the request is safe, false if it looks cross-site.
 */
function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // If there's an Origin header, it must match our host
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  // Fall back to Referer header
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  // No Origin or Referer — likely a non-browser client (e.g. curl, server-to-server).
  // Allow through since session cookie wouldn't be attached from a foreign site anyway.
  return true;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- CSRF Protection ---
  // For mutating API requests, validate Origin/Referer before anything else
  if (pathname.startsWith('/api/') && MUTATING_METHODS.has(request.method)) {
    // Skip CSRF check for:
    // - NextAuth's own endpoints (they have built-in CSRF tokens)
    // - Cron endpoints (called by external services with Bearer token auth, no browser Origin)
    // - Public expense submission endpoint (unauthenticated public form)
    if (!pathname.startsWith('/api/auth') && !pathname.startsWith('/api/cron') && pathname !== '/api/public-expense') {
      if (!isValidOrigin(request)) {
        return NextResponse.json(
          { error: 'CSRF validation failed: cross-origin request blocked' },
          { status: 403 }
        );
      }
    }
  }

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icon-') ||
    pathname.startsWith('/uploads') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff|woff2|ttf)$/)
  ) {
    return NextResponse.next();
  }

  // Check for NextAuth session token
  const token =
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  if (!token) {
    // For API routes, return 401 instead of redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Redirect to login for page routes
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
