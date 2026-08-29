import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { getSettings, updateSettings } from '../controllers/settingsController';

const router = Router();

router.use(authenticate);
router.get('/', getSettings);
router.put('/', authorize('admin'), updateSettings);

export default router;