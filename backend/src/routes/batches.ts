import { Router } from 'express';
import {
  createBatch,
  getAllBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  assignTeacher,
  removeTeacher,
} from '../controllers/batchController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get ('/',    authorize('admin', 'teacher'),            getAllBatches);
router.post('/',    authorize('admin'),                       createBatch);
router.get ('/:id', authorize('admin', 'teacher'),            getBatchById);
router.put ('/:id', authorize('admin'),                       updateBatch);
router.delete('/:id', authorize('admin'),                     deleteBatch);

// Teacher assignment
router.post  ('/:id/teachers',             authorize('admin'), assignTeacher);
router.delete('/:id/teachers/:teacherId',  authorize('admin'), removeTeacher);

export default router;
