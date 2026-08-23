import { Router } from 'express';
import { register, login, getMe, logout, getUsers, deleteUser } from '../controllers/authController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

router.post('/register',        authenticate, authorize('admin'), register);
router.post('/login',           login);
router.get ('/me',              authenticate, getMe);
router.post('/logout',          authenticate, logout);
router.get ('/users',           authenticate, authorize('admin'), getUsers);
router.delete('/users/:id',     authenticate, authorize('admin'), deleteUser);

export default router;
