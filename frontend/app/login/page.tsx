'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { type ApiResponse, type User } from '@/utils/api';
import { saveAuth, isAuthenticated } from '@/utils/auth';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

// ─── Animated orb ─────────────────────────────────────────────────────────────
function Orb({ cx, cy, r, color, delay }: { cx: string; cy: string; r: number; color: string; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: cx, top: cy, width: r * 2, height: r * 2,
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
        transform: 'translate(-50%, -50%)',
        filter: 'blur(60px)',
        opacity: 0.35,
      }}
      animate={{ scale: [1, 1.18, 1], opacity: [0.28, 0.45, 0.28] }}
      transition={{ duration: 4 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

export default function LoginPage() {
  const router = useRouter();
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
      toast.success(`Welcome back, ${user.name}!`);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Login failed';
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4"
         style={{ background: 'linear-gradient(135deg, #07071a 0%, #0e0e2a 50%, #060618 100%)' }}>

      {/* Animated background orbs */}
      <Orb cx="15%"  cy="20%"  r={300} color="#4f46e5" delay={0} />
      <Orb cx="80%"  cy="70%"  r={280} color="#7c3aed" delay={1.5} />
      <Orb cx="50%"  cy="90%"  r={200} color="#2563eb" delay={0.8} />
      <Orb cx="85%"  cy="15%"  r={180} color="#6366f1" delay={2.2} />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
           style={{
             backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
             backgroundSize: '60px 60px',
           }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* ── Logo / Branding ── */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.16,1,0.3,1] }}
            className="inline-flex items-center justify-center mb-5 relative"
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-purple-700
                            flex items-center justify-center shadow-glow-lg">
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-3xl border-2 border-brand-500/40"
              animate={{ scale: [1, 1.3, 1.6], opacity: [0.6, 0.3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-0 rounded-3xl border-2 border-brand-500/25"
              animate={{ scale: [1, 1.3, 1.6], opacity: [0.5, 0.2, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="text-3xl font-black text-white tracking-tight"
          >
            Vision Collegiate
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="text-slate-500 text-sm mt-1.5 font-medium"
          >
            Coaching Institute Management System
          </motion.p>
        </div>

        {/* ── Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-3xl p-8 border border-white/[0.07]"
          style={{ background: 'rgba(13,13,35,0.85)', backdropFilter: 'blur(24px)' }}
        >
          <div className="mb-7">
            <h2 className="text-xl font-bold text-white">Sign in to your account</h2>
            <p className="text-slate-500 text-sm mt-1">Use your institute credentials below</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 text-sm font-medium
                           text-white placeholder:text-slate-700
                           border border-white/[0.08] hover:border-white/[0.14]
                           focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                           transition-all duration-150"
                style={{ background: 'rgba(255,255,255,0.05)' }}
                {...register('email')}
              />
              {errors.email && (
                <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
                           className="mt-1.5 text-xs text-red-400 font-medium">
                  {errors.email.message}
                </motion.p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm font-medium
                             text-white placeholder:text-slate-700
                             border border-white/[0.08] hover:border-white/[0.14]
                             focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                             transition-all duration-150"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2
                             text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
                           className="mt-1.5 text-xs text-red-400 font-medium">
                  {errors.password.message}
                </motion.p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3.5 mt-1 rounded-xl font-bold text-sm text-white
                         bg-gradient-to-r from-brand-600 to-brand-500
                         hover:from-brand-500 hover:to-brand-400
                         shadow-glow hover:shadow-glow-lg
                         transition-all duration-200
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
                         flex items-center justify-center gap-2.5"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-slate-700 mt-6 font-medium"
        >
          Vision Collegiate © {new Date().getFullYear()} — All rights reserved
        </motion.p>
      </motion.div>
    </div>
  );
}
