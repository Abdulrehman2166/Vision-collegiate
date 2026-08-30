import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getWorkingDate, setWorkingDate, getAdminWhatsapp, setAdminWhatsapp } from '../services/settingsService';

/** GET /api/v1/settings – returns app settings (working date + admin WhatsApp number) */
export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const workingDate   = await getWorkingDate();
    const adminWhatsapp = await getAdminWhatsapp();
    res.json({ success: true, data: { workingDate, adminWhatsapp } });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/settings – updates working date and/or admin WhatsApp number. Admin only. */
export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      workingDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
      adminWhatsapp: z.string().min(7).max(15).nullish(),
    });
    const { workingDate, adminWhatsapp } = schema.parse(req.body);

    if (workingDate !== undefined) await setWorkingDate(workingDate ?? null);
    if (adminWhatsapp !== undefined) await setAdminWhatsapp(adminWhatsapp ?? null);

    res.json({
      success: true,
      data: {
        workingDate:   await getWorkingDate(),
        adminWhatsapp: await getAdminWhatsapp(),
      },
    });
  } catch (err) {
    next(err);
  }
}