import { Router } from 'express';
import {
  generateTestPaper,
  getAllTests,
  getTestById,
  exportTestPDF,
  dispatchTestToStudents,
  scheduleTestDispatch,
} from '../controllers/testController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/generate',                 authorize('admin', 'teacher'), generateTestPaper);
router.get ('/',                         authorize('admin', 'teacher'), getAllTests);
router.get ('/:id',                      authorize('admin', 'teacher', 'parent', 'student'), getTestById);
router.get ('/:id/export-pdf',           authorize('admin', 'teacher', 'parent', 'student'), exportTestPDF);
router.post('/:id/dispatch-whatsapp',   authorize('admin', 'teacher'), dispatchTestToStudents);
router.post('/:id/schedule',            authorize('admin', 'teacher'), scheduleTestDispatch);

export default router;
