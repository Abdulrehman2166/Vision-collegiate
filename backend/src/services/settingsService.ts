/**
 * settingsService – small key/value store for app-level settings.
 * Currently used for the "working date" override (the date the school
 * treats as today, which drives Attendance/Dashboard/Analytics defaults).
 */
import { pool } from '../db';

export async function getSetting(key: string): Promise<string | null> {
  const { rows } = await pool.query(
    'SELECT value FROM app_settings WHERE key = $1',
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function getWorkingDate(): Promise<string> {
  const value = await getSetting('working_date');
  if (value) return value;
  return new Date().toISOString().split('T')[0];
}

export async function setWorkingDate(date: string | null): Promise<void> {
  if (date) {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('working_date', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [date],
    );
  } else {
    await pool.query(`DELETE FROM app_settings WHERE key = 'working_date'`);
  }
}