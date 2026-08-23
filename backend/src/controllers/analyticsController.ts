import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analyticsService';

/** GET /api/v1/analytics/attendance/today  ?batchId= */
export async function getTodaySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string) : undefined;
    const data    = await analyticsService.getTodayAttendanceSummary(batchId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/analytics/attendance/trend  ?days=30&batchId= */
export async function getTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const days    = parseInt(req.query.days    as string) || 30;
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string) : undefined;
    const data    = await analyticsService.getAttendanceTrend(days, batchId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/analytics/attendance/alerts  ?threshold=75&batchId= */
export async function getAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const threshold = parseInt(req.query.threshold as string) || 75;
    const batchId   = req.query.batchId ? parseInt(req.query.batchId as string) : undefined;
    const data      = await analyticsService.getLowAttendanceAlerts(threshold, batchId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/analytics/batches/summary */
export async function getBatchSummaries(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getBatchAttendanceSummaries();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/analytics/attendance/heatmap  ?days=90&batchId= */
export async function getHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const days    = parseInt(req.query.days    as string) || 90;
    const batchId = req.query.batchId ? parseInt(req.query.batchId as string) : undefined;
    const data    = await analyticsService.getAttendanceHeatmap(days, batchId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
