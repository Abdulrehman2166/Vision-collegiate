import { Router } from 'express';
import { getTestSchedule, updateTestSchedule } from '../controllers/scheduleController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/',                    authenticate, getTestSchedule);
router.put('/',                    authorize('admin'), updateTestSchedule);

export default router;