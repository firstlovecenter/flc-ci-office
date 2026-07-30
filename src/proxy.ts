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

const MAINTENANCE_COOKIE = 'maintenance-bypass';

/**
 * Maintenance mode — set MAINTENANCE_MODE=1 to close the site to everyone.
 *
 * Used to hold the database still during a data migration. Sessions are JWTs
 * and cannot be revoked server-side, so blocking at the edge is the only way to
 * guarantee no writes land mid-migration.
 *
 * To get in while it is on, visit any URL with ?bypass=<MAINTENANCE_BYPASS>.
 * That sets a cookie so subsequent navigation works normally.
 */
function maintenanceResponse(request: NextRequest): NextResponse | null {
  if (process.env.MAINTENANCE_MODE !== '1') return null;

  const secret = process.env.MAINTENANCE_BYPASS;
  const { pathname, searchParams } = request.nextUrl;

  if (secret) {
    if (searchParams.get('bypass') === secret) {
      const url = request.nextUrl.clone();
      url.searchParams.delete('bypass');
      const res = NextResponse.redirect(url);
      res.cookies.set(MAINTENANCE_COOKIE, secret, { httpOnly: true, sameSite: 'strict', path: '/' });
      return res;
    }
    if (request.cookies.get(MAINTENANCE_COOKIE)?.value === secret) return null;
  }

  // Let the service worker and icons resolve so the PWA shell does not error.
  if (pathname.startsWith('/_next') || pathname === '/sw.js' || pathname.startsWith('/icon-')) {
    return null;
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'The system is temporarily closed for scheduled maintenance. Please try again shortly.' },
      { status: 503, headers: { 'Retry-After': '3600' } }
    );
  }

  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Scheduled maintenance — CI Office</title>
     <div style="font-family:system-ui,-apple-system,sans-serif;max-width:34rem;margin:18vh auto;padding:0 1.5rem;text-align:center;color:#161A1F">
       <h1 style="font-size:1.5rem;font-weight:600;margin:0 0 .75rem">Scheduled maintenance</h1>
       <p style="color:#6B7280;line-height:1.6;margin:0">CI Office is briefly closed while we carry out planned database work.
       No action is needed — please try again shortly. Any transaction you already submitted is safe.</p>
     </div>`,
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '3600' } }
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Closed for maintenance? Nothing else runs.
  const maintenance = maintenanceResponse(request);
  if (maintenance) return maintenance;

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
