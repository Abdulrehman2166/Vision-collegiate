'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { type ApiResponse, type User } from '@/utils/api';
import { saveAuth, isAuthenticated } from '@/utils/auth';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard');
  }, [router]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
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
         style={{ background: 'linear-gradient(135deg, #08081a 0%, #0f0f2e 50%, #0a0a1f 100%)' }}>

      {/* Background orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] pointer-events-none"
           style={{ background: 'radial-gradient(circle, #4f46e5, transparent)' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[100px] pointer-events-none"
           style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full opacity-10 blur-[80px] pointer-events-none"
           style={{ background: 'radial-gradient(circle, #2563eb, transparent)' }} />

      <div className="w-full max-w-[420px] relative z-10">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-5 relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-purple-600
                            flex items-center justify-center shadow-glow-lg">
              <span className="text-4xl font-black text-white">V</span>
            </div>
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500 to-purple-600
                            opacity-30 blur-xl -z-10 scale-110" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Vision Collegiate</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">Coaching Institute Management</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-8 border border-white/[0.08]
                        shadow-[0_25px_80px_rgba(0,0,0,0.5)]"
             style={{ background: 'rgba(15,15,35,0.8)', backdropFilter: 'blur(24px)' }}>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Sign in</h2>
            <p className="text-slate-400 text-sm mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm font-medium
                           text-white placeholder:text-slate-600
                           border border-white/[0.08] focus:border-brand-500/60
                           focus:outline-none focus:ring-2 focus:ring-brand-500/20
                           transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.04)' }}
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm font-medium
                             text-white placeholder:text-slate-600
                             border border-white/[0.08] focus:border-brand-500/60
                             focus:outline-none focus:ring-2 focus:ring-brand-500/20
                             transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 mt-2 rounded-xl font-bold text-sm text-white
                         bg-gradient-to-r from-brand-600 to-brand-500
                         hover:from-brand-500 hover:to-brand-400
                         shadow-glow hover:shadow-glow-lg
                         transition-all duration-200 active:scale-[0.98]
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
                         flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />
                  Signing in…
                </>
              ) : (
                'Sign In →'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6 font-medium">
          Vision Collegiate © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
