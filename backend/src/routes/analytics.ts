import { Router } from 'express';
import {
  getTodaySummary,
  getTrend,
  getAlerts,
  getBatchSummaries,
  getHeatmap,
} from '../controllers/analyticsController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'teacher'));

router.get('/attendance/today',   getTodaySummary);
router.get('/attendance/trend',   getTrend);
router.get('/attendance/alerts',  getAlerts);
router.get('/attendance/heatmap', getHeatmap);
router.get('/batches/summary',    getBatchSummaries);

export default router;
