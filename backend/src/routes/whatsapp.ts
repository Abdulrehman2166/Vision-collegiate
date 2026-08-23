import { Router } from 'express';
import {
  sendDocument,
  sendText,
  getLogs,
  getLogById,
  handleWebhook,
  verifyWebhook,
} from '../controllers/whatsappController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

// Webhook endpoints are NOT authenticated (Meta calls them directly)
router.get ('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// All other endpoints require auth
router.use(authenticate);

router.post('/send-document', authorize('admin', 'teacher'), sendDocument);
router.post('/send-text',     authorize('admin', 'teacher'), sendText);
router.get ('/logs',          authorize('admin'),             getLogs);
router.get ('/logs/:id',      authorize('admin'),             getLogById);

export default router;
