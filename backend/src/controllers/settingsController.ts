import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getWorkingDate, setWorkingDate } from '../services/settingsService';

/** GET /api/v1/settings – returns the app working date (null if not overridden) */
export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const workingDate = await getSettingValue();
    res.json({ success: true, data: { workingDate } });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/settings – sets (or clears) the working date. Admin only. */
export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      workingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    });
    const { workingDate } = schema.parse(req.body);
    await setWorkingDate(workingDate ?? null);
    const after = await getSettingValue();
    res.json({ success: true, data: { workingDate: after } });
  } catch (err) {
    next(err);
  }
}

/** Reads the effective working date: the override if set, otherwise real today. */
async function getSettingValue(): Promise<string> {
  return getWorkingDate();
}