import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getMe, logout, getUsers, deleteUser, changePassword } from '../controllers/authController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();

// ─── Rate limiters ─────────────────────────────────────────────────────────────
// Strict limit on login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true, // only count failed requests
});

// Register: 5 creations per hour (admin action, rarely needed)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again in an hour.' },
});

router.post('/register',        registerLimiter, authenticate, authorize('admin'), register);
router.post('/login',           loginLimiter, login);
router.get ('/me',              authenticate, getMe);
router.post('/logout',          authenticate, logout);
router.get ('/users',           authenticate, authorize('admin'), getUsers);
router.delete('/users/:id',     authenticate, authorize('admin'), deleteUser);
router.post('/change-password', authenticate, changePassword);

export default router;
