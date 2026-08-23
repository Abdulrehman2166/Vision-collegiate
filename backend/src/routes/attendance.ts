import { Router } from 'express';
import {
  markBatchAttendance,
  getBatchAttendanceByDate,
  getStudentAttendance,
  generateAttendancePDF,
  sendAttendanceToParents,
} from '../controllers/attendanceController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/mark',                    authorize('admin', 'teacher'), markBatchAttendance);
router.get ('/batch/:batchId',          authorize('admin', 'teacher'), getBatchAttendanceByDate);
router.get ('/student/:studentId',      authorize('admin', 'teacher', 'parent', 'student'), getStudentAttendance);
router.post('/reports/generate-pdf',   authorize('admin', 'teacher'), generateAttendancePDF);
router.post('/reports/send-whatsapp',  authorize('admin', 'teacher'), sendAttendanceToParents);

export default router;
