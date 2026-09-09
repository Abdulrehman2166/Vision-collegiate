import { Router } from 'express';
import {
  getSummary,
  getTimeline,
  getExpenses,
  createExpense,
  deleteExpense,
  getStudentFees,
  createFeeRecord,
  updateFeeRecord,
  deleteFeeRecord,
} from '../controllers/financeController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/summary',  getSummary);
router.get('/timeline', getTimeline);
router.get('/expenses', getExpenses);
router.post('/expenses', createExpense);
router.delete('/expenses/:id', deleteExpense);

router.get('/fees',    getStudentFees);
router.post('/fees',   createFeeRecord);
router.patch('/fees/:id', updateFeeRecord);
router.delete('/fees/:id', deleteFeeRecord);

export default router;