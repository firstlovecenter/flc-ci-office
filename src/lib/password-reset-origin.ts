/**
 * The configured public origin of the app, or null when it is not configured.
 * Links are never built from request headers or hard-coded fallbacks: an
 * unconfigured origin means no link is sent (fail closed).
 */
export function getAppOrigin(): string | null {
  const raw = (process.env.NEXTAUTH_URL || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) return null;
    return url.origin;
  } catch {
    return null;
  }
}
