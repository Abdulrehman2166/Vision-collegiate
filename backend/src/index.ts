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
import settingsRouter   from './routes/settings';
import scheduleRouter   from './routes/schedule';

dotenv.config();

const app = express();

// ─── Trust proxy (required for Back4App / reverse proxies) ────────────────────
app.set('trust proxy', 1);

// ─── Security & parsing ───────────────────────────────────────────────────────
app.use(helmet());

// Allow multiple CORS origins: comma-separated list in CORS_ORIGIN env var
const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://vision-collegiate.vercel.app',
  ...configuredOrigins,
];

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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── WhatsApp webhook: capture raw body BEFORE json() parses it ───────────────
// Meta webhook POST needs the raw body for HMAC signature verification.
app.use('/api/v1/whatsapp/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  // Attach rawBody so the controller can verify the signature
  (req as express.Request & { rawBody?: Buffer }).rawBody = req.body as Buffer;
  // Re-parse as JSON so controllers can access req.body normally
  try { req.body = JSON.parse((req.body as Buffer).toString('utf8')); } catch { req.body = {}; }
  next();
});

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
app.use(`${v1}/settings`,   settingsRouter);
app.use(`${v1}/schedule`,   scheduleRouter);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Prevent crashes from unhandled promise rejections (e.g. Puppeteer) ───────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception – shutting down:', { message: err.message, stack: err.stack });
  process.exit(1);
});

// ─── Start (only when run directly, not on Vercel serverless) ────────────────
// On Vercel the app is imported by api/index.ts and managed as a function.
if (process.env.VERCEL !== '1') {
  const PORT = parseInt(process.env.PORT ?? '3000', 10);
  app.listen(PORT, () => {
    logger.info(`Vision Collegiate API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
    startScheduler();
  });
}

export default app;
