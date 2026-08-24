/**
 * auth.ts — client-side auth helpers.
 *
 * Security: The JWT lives exclusively in an HttpOnly cookie set by the backend.
 * We only store the lightweight user profile (no token) in localStorage so the
 * UI can read name/role/email without extra API calls.
 */
import type { User } from './api';

const USER_KEY = 'vc_user';

/** Called after successful login — store user profile only (NOT the token). */
export function saveAuth(_token: string, user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Clear user profile from localStorage (cookie is cleared by the backend logout endpoint). */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
}

/** Read cached user profile from localStorage. */
export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/**
 * Check if the user is "authenticated" on the client side.
 * We rely on the existence of the user profile in localStorage as a proxy
 * (the real gate is the HttpOnly cookie checked server-side by middleware.ts).
 */
export function isAuthenticated(): boolean {
  return !!getUser();
}

export function hasRole(...roles: User['role'][]): boolean {
  const user = getUser();
  return !!user && roles.includes(user.role);
}
