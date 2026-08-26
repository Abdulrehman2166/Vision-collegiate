/**
 * middleware.ts — Next.js Edge Middleware for server-side route protection.
 *
 * Runs on the Edge runtime before any page renders.
 * Checks for the HttpOnly `token` cookie. If absent on a protected route,
 * redirects to /login immediately — no flash of protected content.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that do NOT require authentication
const PUBLIC_PATHS = ['/login', '/api'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/icons') ||
    pathname === '/';

  if (isPublic) {
    // If already authenticated and hitting /login, redirect to dashboard
    if (pathname === '/login') {
      const token = request.cookies.get('token');
      if (token?.value) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    return NextResponse.next();
  }

  // Protected route: require the HttpOnly cookie
  const token = request.cookies.get('token');
  if (!token?.value) {
    const loginUrl = new URL('/login', request.url);
    // Preserve the intended destination so we can redirect back after login
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude /api routes — they are handled by rewrites (proxied to backend)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|api).*)',
  ],
};
