import { Router } from 'express';
import {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
} from '../controllers/studentController';
import { getPerformance, getStudentProgress, getMyStudents } from '../controllers/studentPerformanceController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get ('/performance', authorize('admin', 'teacher'), getPerformance);
router.get ('/linked',      authorize('parent', 'student'), getMyStudents);
router.get ('/',    authorize('admin', 'teacher'),                    getAllStudents);
router.post('/',    authorize('admin'),                               createStudent);
router.get ('/:id', authorize('admin', 'teacher', 'parent', 'student'), getStudentById);
router.get ('/:id/performance', authorize('admin', 'teacher', 'parent', 'student'), getStudentProgress);
router.put ('/:id', authorize('admin', 'teacher'),                   updateStudent);
router.delete('/:id', authorize('admin'),                            deleteStudent);

export default router;
