import type { UserRole } from '../types';

const DISALLOWED_REDIRECT_PREFIXES = ['/login', '/403'];

export function getDefaultHomePath(role?: UserRole): string {
  if (role === 'ADMIN') return '/admin/users';
  return '/';
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Validates that a candidate redirect path is a safe internal path within the app
 * and permitted for the authenticated user's role.
 */
export function getSafeRedirectPath(rawPath: unknown, role: UserRole): string {
  const fallback = getDefaultHomePath(role);

  if (typeof rawPath !== 'string') {
    return fallback;
  }

  const trimmed = rawPath.trim();
  if (!trimmed) {
    return fallback;
  }

  // Must start with a single '/' and not '//' or '/\' (prevents protocol-relative and external open redirects)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Block control characters or embedded schemes
  if (hasControlChars(trimmed) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed, 'http://olms.local');
  } catch {
    return fallback;
  }

  if (parsedUrl.origin !== 'http://olms.local') {
    return fallback;
  }

  const pathname = parsedUrl.pathname;

  if (
    DISALLOWED_REDIRECT_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return fallback;
  }

  // Do not redirect non-ADMIN users into /admin/* routes after login
  if (role !== 'ADMIN' && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    return fallback;
  }

  // Do not redirect STUDENT into /account/password (restricted to ADMIN/TEACHER)
  if (role === 'STUDENT' && pathname.startsWith('/account/password')) {
    return fallback;
  }

  return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
}
