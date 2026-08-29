import { Router } from 'express';
import {
  markBatchAttendance,
  getBatchAttendanceByDate,
  getAttendanceByDate,
  getStudentAttendance,
  generateAttendancePDF,
  sendAttendanceToParents,
  runPdfDebug,
} from '../controllers/attendanceController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/mark',                    authorize('admin', 'teacher'), markBatchAttendance);
router.get ('/all',                     authorize('admin', 'teacher'), getAttendanceByDate);
router.get ('/batch/:batchId',          authorize('admin', 'teacher'), getBatchAttendanceByDate);
router.get ('/student/:studentId',      authorize('admin', 'teacher', 'parent', 'student'), getStudentAttendance);
router.post('/reports/generate-pdf',   authorize('admin', 'teacher'), generateAttendancePDF);
router.get ('/debug/pdf',              authorize('admin', 'teacher'), runPdfDebug);
router.post('/reports/send-whatsapp',  authorize('admin', 'teacher'), sendAttendanceToParents);

export default router;
