import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { startScheduler } from './scheduler';

import authRouter       from './routes/auth';
import studentsRouter   from './routes/students';
import batchesRouter    from './routes/batches';
import attendanceRouter from './routes/attendance';
import testsRouter      from './routes/tests';
import whatsappRouter   from './routes/whatsapp';
import analyticsRouter  from './routes/analytics';

dotenv.config();

const app = express();

// ─── Security & parsing ───────────────────────────────────────────────────────
app.use(helmet());

// Allow multiple CORS origins: comma-separated list in CORS_ORIGIN env var
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3001')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API v1 routes ────────────────────────────────────────────────────────────
const v1 = '/api/v1';
app.use(`${v1}/auth`,       authRouter);
app.use(`${v1}/students`,   studentsRouter);
app.use(`${v1}/batches`,    batchesRouter);
app.use(`${v1}/attendance`, attendanceRouter);
app.use(`${v1}/tests`,      testsRouter);
app.use(`${v1}/whatsapp`,   whatsappRouter);
app.use(`${v1}/analytics`,  analyticsRouter);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, () => {
  logger.info(`Vision Collegiate API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
  startScheduler();
});

export default app;
