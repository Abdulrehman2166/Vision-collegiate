import { Router } from 'express';
import {
  generateTestPaper,
  getAllTests,
  getTestById,
  exportTestPDF,
  dispatchTestToStudents,
  scheduleTestDispatch,
} from '../controllers/testController';
import {
  saveTestMarks,
  getTestMarks,
  generateMonthlyAnalytics,
} from '../controllers/testResultsController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/generate',                 authorize('admin', 'teacher'), generateTestPaper);
router.get ('/',                         authorize('admin', 'teacher'), getAllTests);
router.post('/reports/monthly-analytics', authorize('admin', 'teacher', 'parent', 'student'), generateMonthlyAnalytics);
router.post('/:id/marks',                authorize('admin', 'teacher'), saveTestMarks);
router.get ('/:id/marks',                authorize('admin', 'teacher'), getTestMarks);
router.get ('/:id',                      authorize('admin', 'teacher', 'parent', 'student'), getTestById);
router.get ('/:id/export-pdf',           authorize('admin', 'teacher', 'parent', 'student'), exportTestPDF);
router.post('/:id/dispatch-whatsapp',   authorize('admin', 'teacher'), dispatchTestToStudents);
router.post('/:id/schedule',            authorize('admin', 'teacher'), scheduleTestDispatch);

export default router;
