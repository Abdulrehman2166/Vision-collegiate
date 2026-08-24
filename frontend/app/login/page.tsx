'use client';

import { useState, useEffect, useRef } from 'react';
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

// ─── Particle canvas background ───────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    const PARTICLE_COUNT = 70;
    interface Particle { x: number; y: number; vx: number; vy: number; r: number; alpha: number; }
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.8 + 0.4,
      alpha: Math.random() * 0.5 + 0.15,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99,102,241,${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${p.alpha})`;
        ctx.fill();

        // Move
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}

// ─── Animated gradient orbs ────────────────────────────────────────────────────
function Orbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { cx: '10%',  cy: '15%',  size: 600, color: '#4f46e5', delay: 0,   dur: 8  },
        { cx: '85%',  cy: '75%',  size: 500, color: '#7c3aed', delay: 1.5, dur: 10 },
        { cx: '55%',  cy: '95%',  size: 400, color: '#2563eb', delay: 0.8, dur: 9  },
        { cx: '90%',  cy: '10%',  size: 350, color: '#6366f1', delay: 2.2, dur: 7  },
        { cx: '30%',  cy: '60%',  size: 280, color: '#a855f7', delay: 3,   dur: 11 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: orb.cx, top: orb.cy,
            width: orb.size, height: orb.size,
            background: `radial-gradient(circle, ${orb.color}55 0%, transparent 70%)`,
            transform: 'translate(-50%, -50%)',
            filter: 'blur(80px)',
          }}
          animate={{ scale: [1, 1.2, 0.9, 1], opacity: [0.4, 0.7, 0.35, 0.4] }}
          transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut', delay: orb.delay }}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const [showPw, setShowPw] = useState(false);
  const [logoError, setLogoError] = useState(false);

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
      if (status === 429) {
        toast.error('Too many attempts. Please wait 15 minutes.');
      } else {
        toast.error(msg ?? 'Invalid email or password');
      }
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden p-4"
      style={{ background: 'linear-gradient(135deg, #04040f 0%, #08082a 40%, #05051a 100%)' }}
    >
      {/* Layered background */}
      <Orbs />
      <ParticleCanvas />

      {/* Dot-grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(99,102,241,0.18) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.6,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] relative z-10"
      >
        {/* ── Branding ─────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center justify-center mb-6 relative"
          >
            {/* Outer rotating ring */}
            <motion.div
              className="absolute rounded-full border border-brand-500/20"
              style={{ width: 110, height: 110 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />
            {/* Inner pulsing ring */}
            <motion.div
              className="absolute rounded-full border border-purple-500/15"
              style={{ width: 90, height: 90 }}
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            />

            {/* Logo container */}
            <motion.div
              className="relative w-[76px] h-[76px] rounded-2xl overflow-hidden flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 0 40px -8px rgba(99,102,241,0.6), 0 0 80px -16px rgba(139,92,246,0.4)',
              }}
              animate={{ boxShadow: [
                '0 0 40px -8px rgba(99,102,241,0.5)',
                '0 0 60px -6px rgba(139,92,246,0.7)',
                '0 0 40px -8px rgba(99,102,241,0.5)',
              ]}}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              {!logoError ? (
                <Image
                  src="/logo.png"
                  alt="Vision Collegiate"
                  width={64}
                  height={64}
                  className="object-contain p-1"
                  onError={() => setLogoError(true)}
                  priority
                />
              ) : (
                <span className="text-2xl font-black text-white">V</span>
              )}
            </motion.div>

            {/* Pulse rings */}
            {[0, 0.5, 1].map((delay) => (
              <motion.div
                key={delay}
                className="absolute rounded-full border border-brand-500/20"
                style={{ width: 76, height: 76 }}
                animate={{ scale: [1, 1.8, 2.4], opacity: [0.5, 0.2, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay }}
              />
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <h1 className="text-[28px] font-black text-white tracking-tight leading-tight">
              Vision{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #818cf8, #c084fc, #818cf8)', backgroundSize: '200%' }}
              >
                Collegiate
              </span>
            </h1>
            <p className="text-slate-500 text-sm mt-1.5 font-medium tracking-wide">
              Coaching Institute Management System
            </p>
          </motion.div>
        </div>

        {/* ── Glass card ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(8, 8, 30, 0.75)',
            backdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Top shimmer line */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(99,102,241,0.8), rgba(139,92,246,0.6), transparent)' }}
          />

          <div className="p-8">
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-3.5 h-3.5 text-brand-400" />
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
                             placeholder:text-slate-600 transition-all duration-200 outline-none
                             focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500/60"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  {...register('email')}
                />
                <AnimatePresence>
                  {errors.email && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1.5 text-xs text-red-400 font-medium flex items-center gap-1"
                    >
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
                               placeholder:text-slate-600 transition-all duration-200 outline-none
                               focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500/60"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2
                               text-slate-600 hover:text-slate-300 transition-colors p-0.5"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <AnimatePresence>
                  {errors.password && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-1.5 text-xs text-red-400 font-medium flex items-center gap-1"
                    >
                      <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
                      {errors.password.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
                className="relative w-full py-3.5 mt-2 rounded-xl font-bold text-sm text-white
                           overflow-hidden transition-all duration-200
                           disabled:opacity-60 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2.5"
                style={{
                  background: isSubmitting
                    ? 'rgba(79,70,229,0.5)'
                    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  boxShadow: isSubmitting ? 'none' : '0 0 30px -4px rgba(99,102,241,0.55), 0 4px 16px rgba(0,0,0,0.3)',
                }}
              >
                {/* Animated shine on hover */}
                {!isSubmitting && (
                  <motion.div
                    className="absolute inset-0 opacity-0 hover:opacity-100"
                    style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)' }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
                  />
                )}
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />
                    Verifying credentials…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-xs text-slate-700 mt-6 font-medium"
        >
          Vision Collegiate © {new Date().getFullYear()} — All rights reserved
        </motion.p>
      </motion.div>
    </div>
  );
}
