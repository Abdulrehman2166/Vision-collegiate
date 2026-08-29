/**
 * dates.ts – shared date helpers.
 *
 * Provides the app's "working date" (the date the school treats as today).
 * The backend returns it from /settings; if no override is set it falls back
 * to the real current date. The result is cached for the session.
 */
import { format } from 'date-fns';
import api from './api';

let cached: string | null = null;
let settingsReady: Promise<string> | null = null;

function realToday(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Fetch the working date from the backend (cached per session). */
export function getWorkingDate(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (!settingsReady) {
    settingsReady = api
      .get<{ success: boolean; data: { workingDate: string } }>('/settings')
      .then((r) => {
        cached = r.data.data?.workingDate ?? realToday();
        return cached;
      })
      .catch(() => realToday());
  }
  return settingsReady;
}

/** Real date of today as YYYY-MM-DD (ignore any override). */
export function getRealToday(): string {
  return realToday();
}