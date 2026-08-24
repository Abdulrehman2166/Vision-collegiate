'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, Shield, Zap } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import api, { type ApiResponse, type User } from '@/utils/api';
import { saveAuth, isAuthenticated } from '@/utils/auth';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

// ─── Particle canvas — optimised ──────────────────────────────────────────────
// Uses a spatial bucket grid so connection-line check is O(n) not O(n²).
// Throttled to 30 fps so it never competes with the UI thread.
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let lastT = 0;
    const FPS_INTERVAL = 1000 / 30; // 30 fps cap

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Fewer particles — 35 instead of 70
    const COUNT = 35;
    interface P { x: number; y: number; vx: number; vy: number; r: number; a: number; }
    const ps: P[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.4,
      a: Math.random() * 0.45 + 0.12,
    }));

    const LINK_DIST = 110;
    const BUCKET = LINK_DIST; // one cell = one link distance

    const draw = (ts: number) => {
      animId = requestAnimationFrame(draw);

      // Throttle to 30 fps
      const elapsed = ts - lastT;
      if (elapsed < FPS_INTERVAL) return;
      lastT = ts - (elapsed % FPS_INTERVAL);

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // ── Spatial grid for O(n) connection lookup ──────────────────────
      const cols = Math.ceil(W / BUCKET) + 1;
      const grid: Map<number, P[]> = new Map();
      for (const p of ps) {
        const ci = Math.floor(p.x / BUCKET);
        const ri = Math.floor(p.y / BUCKET);
        const key = ri * cols + ci;
        const cell = grid.get(key);
        if (cell) cell.push(p); else grid.set(key, [p]);
      }

      // Draw lines — check only neighbouring cells
      for (const p of ps) {
        const ci = Math.floor(p.x / BUCKET);
        const ri = Math.floor(p.y / BUCKET);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const neighbours = grid.get((ri + dr) * cols + ci + dc);
            if (!neighbours) continue;
            for (const q of neighbours) {
              if (q === p) continue;
              const dx = p.x - q.x;
              const dy = p.y - q.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < LINK_DIST * LINK_DIST) {
                const alpha = 0.1 * (1 - Math.sqrt(d2) / LINK_DIST);
                ctx.beginPath();
                ctx.strokeStyle = `rgba(99,102,241,${alpha})`;
                ctx.lineWidth = 0.5;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.stroke();
              }
            }
          }
        }
        // Draw dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${p.a})`;
        ctx.fill();

        // Move
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.55 }}
    />
  );
}

// ─── Static CSS orbs — no Framer Motion animate loop ──────────────────────────
// Uses CSS @keyframes in globals.css so the GPU handles it, not JS.
function StaticOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
    </div>
  );
}

// ─── Inner login content (needs useSearchParams, wrapped in Suspense) ─────────
function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard');
  }, [router]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    try {
      const res = await api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', data);
      const { token, user } = res.data.data;
      saveAuth(token, user);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      const next = searchParams.get('next') ?? '/dashboard';
      router.push(next);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const msg    = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (status === 429) toast.error('Too many attempts. Wait 15 minutes.');
      else toast.error(msg ?? 'Invalid email or password');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[440px] relative z-10"
    >
      {/* ── Branding ──────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-6 relative">
          {/* Slow CSS rotating ring — no JS animation */}
          <div className="absolute rounded-full border border-indigo-500/20 login-ring-outer" style={{ width: 112, height: 112 }} />
          <div className="absolute rounded-full border border-purple-500/15 login-ring-inner" style={{ width: 90, height: 90 }} />

          {/* Logo box */}
          <div
            className="relative w-[76px] h-[76px] rounded-2xl overflow-hidden flex items-center justify-center logo-pulse"
            style={{
              background: 'rgba(255,255,255,0.0)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* mix-blend-mode:screen removes the white PNG background on dark bg */}
            <Image
              src="/logo.png"
              alt="Vision Collegiate"
              width={68}
              height={68}
              className="object-contain logo-blend"
              priority
            />
          </div>

          {/* Pulse rings — CSS animation */}
          <div className="absolute rounded-full border border-indigo-500/25 pulse-ring" style={{ width: 76, height: 76 }} />
          <div className="absolute rounded-full border border-indigo-500/15 pulse-ring pulse-ring-2" style={{ width: 76, height: 76 }} />
        </div>

        <h1 className="text-[28px] font-black text-white tracking-tight leading-tight">
          Vision{' '}
          <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #818cf8, #c084fc)' }}>
            Collegiate
          </span>
        </h1>
        <p className="text-slate-500 text-sm mt-1.5 font-medium tracking-wide">
          Coaching Institute Management System
        </p>
      </div>

      {/* ── Glass card ────────────────────────────────────────────────── */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(8,8,30,0.78)',
          backdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Top shimmer */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.7), rgba(99,102,241,0.9), rgba(139,92,246,0.7), transparent)' }}
        />

        <div className="p-8">
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Secure Sign In</h2>
            </div>
            <p className="text-slate-500 text-sm">Enter your institute credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
                Email Address
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white
                           placeholder:text-slate-600 outline-none
                           transition-[border-color,box-shadow] duration-150
                           focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500/50"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                {...register('email')}
              />
              <AnimatePresence>
                {errors.email && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-1.5 text-xs text-red-400 font-medium flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
                    {errors.email.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 pr-12 text-sm font-medium text-white
                             placeholder:text-slate-600 outline-none
                             transition-[border-color,box-shadow] duration-150
                             focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500/50"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors p-0.5"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-1.5 text-xs text-red-400 font-medium flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
                    {errors.password.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="relative w-full py-3.5 mt-2 rounded-xl font-bold text-sm text-white
                         overflow-hidden transition-[opacity,transform] duration-150
                         hover:scale-[1.01] active:scale-[0.98]
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
                         flex items-center justify-center gap-2.5"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                boxShadow: isSubmitting ? 'none' : '0 0 28px -4px rgba(99,102,241,0.55)',
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />
                  Verifying…
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <p className="text-center text-xs text-slate-700 mt-6 font-medium">
        Vision Collegiate © {new Date().getFullYear()} — All rights reserved
      </p>
    </motion.div>
  );
}

// ─── Page export — wraps in Suspense for useSearchParams ──────────────────────
export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden p-4"
      style={{ background: 'linear-gradient(135deg, #04040f 0%, #08082a 40%, #05051a 100%)' }}
    >
      <StaticOrbs />
      <ParticleCanvas />

      {/* Dot-grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(99,102,241,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.5,
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.6) 100%)' }}
      />

      <Suspense fallback={null}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
