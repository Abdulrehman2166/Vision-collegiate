import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db';
import { createError } from '../middleware/errorHandler';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
});

const registerSchema = z.object({
  name:     z.string().min(2),
  email:    z.string().email(),
  password: z.string().min(8),
  role:     z.enum(['admin', 'teacher', 'parent', 'student']),
  phone:    z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

function signToken(payload: { id: number; role: string; email: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions);
}

/** POST /api/v1/auth/register  (admin only – enforced in route) */
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length) throw createError('Email already registered', 409);

    const hashed = await bcrypt.hash(data.password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, phone)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, phone, created_at`,
      [data.name, data.email, hashed, data.role, data.phone ?? null],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/login */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);

    const result = await pool.query(
      'SELECT id, name, email, password, role FROM users WHERE email = $1 AND is_active = TRUE',
      [data.email],
    );
    if (!result.rows.length) throw createError('Invalid credentials', 401);

    const user = result.rows[0];
    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) throw createError('Invalid credentials', 401);

    const token = signToken({ id: user.id, role: user.role, email: user.email });

    // Set HttpOnly cookie for SSR frontend
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/auth/me */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = $1',
      [req.user!.id],
    );
    if (!result.rows.length) throw createError('User not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/logout */
export async function logout(_req: Request, res: Response) {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out' });
}

/** GET /api/v1/auth/users  (admin only) */
export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const countRes = await pool.query('SELECT COUNT(*) FROM users');
    const total    = parseInt(countRes.rows[0].count);

    const result = await pool.query(
      `SELECT id, name, email, role, phone, is_active, created_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/auth/users/:id  (admin only) */
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user!.id) throw createError('Cannot delete your own account', 400);
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) throw createError('User not found', 404);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/change-password */
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    // Fetch current hash
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user!.id]);
    if (!result.rows.length) throw createError('User not found', 404);

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!valid) throw createError('Current password is incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = $1, updated_at = now() WHERE id = $2', [hashed, req.user!.id]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}
