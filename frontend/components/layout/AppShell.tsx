'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { isAuthenticated, getUser } from '@/utils/auth';
import type { User } from '@/utils/api';
import { Sidebar } from './Sidebar';
import { HeaderBar } from './HeaderBar';
import { ClockCalendar } from './ClockCalendar';
import { PageLoader } from '@/components/ui/Loading';
import { Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AppShellProps { children: React.ReactNode; }

/** Role requirements per route prefix — mirrors Sidebar NAV (no entry = any authenticated role). */
const ROLE_ROUTES: { prefix: string; roles: User['role'][] }[] = [
  { prefix: '/progress',    roles: ['parent', 'student'] },
  { prefix: '/students',    roles: ['admin', 'teacher'] },
  { prefix: '/batches',     roles: ['admin', 'teacher'] },
  { prefix: '/attendance',  roles: ['admin', 'teacher'] },
  { prefix: '/scoring',     roles: ['admin', 'teacher'] },
  { prefix: '/analytics',   roles: ['admin', 'teacher'] },
  { prefix: '/intelligence',roles: ['admin', 'teacher'] },
  { prefix: '/finance',     roles: ['admin'] },
  { prefix: '/users',       roles: ['admin'] },
  { prefix: '/whatsapp',    roles: ['admin'] },
  { prefix: '/settings',    roles: ['admin'] },
];

/** Cinematic system-boot overlay played once on first mount. */
function BootScreen({ done }: { done: boolean }) {
  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #04040f, #0a0a2a 60%, #04040f)' }}
        >
          <div className="ambient-bg" aria-hidden>
            <div className="ambient-blob ambient-blob-1" />
            <div className="ambient-blob ambient-blob-2" />
          </div>

          <div className="relative flex items-center justify-center mb-8">
<div className="absolute w-28 h-28 rounded-full border border-sky-500/25 boot-rings" />
              <div className="absolute w-20 h-20 rounded-full border border-cyan-400/20 boot-rings" style={{ animationDirection: 'reverse', animationDuration: '2.4s' }} />
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center logo-pulse" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <Image src="/logo.png" alt="Vision Collegiate" width={56} height={56} className="object-contain logo-blend" priority />
            </div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl font-black text-white tracking-tight mb-1"
          >
            Vision <span className="text-gradient text-gradient-anim">Collegiate</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="hud-chip mb-8 boot-bar-glow">
            Initializing system
          </motion.p>

          <div className="w-56 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.15, ease: 'easeInOut' }}
              className="h-full progress-shimmer"
              style={{ background: 'linear-gradient(90deg, #0369a1, #0ea5e9, #38bdf8, #0ea5e9, #0369a1)', backgroundSize: '200% 100%' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppShell({ children }: AppShellProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready,       setReady]       = useState(false);
  const [booting,     setBooting]     = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [glow, setGlow]               = useState({ x: -600, y: -600 });

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setReady(true);
    // Route-level role guard — silently send back users who don't belong here.
    const user = getUser();
    const guard = ROLE_ROUTES.find((r) => pathname.startsWith(r.prefix));
    if (guard && user && !guard.roles.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [router, pathname]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Boot overlay plays once, then hands over
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 1100);
    return () => clearTimeout(t);
  }, []);

  // Cursor spotlight — rAF-throttled glow that follows the pointer
  useEffect(() => {
    let raf = 0;
    const move = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setGlow({ x: e.clientX, y: e.clientY }));
    };
    window.addEventListener('mousemove', move, { passive: true });
    return () => { window.removeEventListener('mousemove', move); cancelAnimationFrame(raf); };
  }, []);

  if (!ready) return <PageLoader />;

  return (
    <>
      <BootScreen done={!booting} />

      <div className="relative flex min-h-screen" style={{ background: 'linear-gradient(180deg, #04040f 0%, #06061a 100%)' }}>
        {/* Ambient aurora + energy sweep + grid + scanlines — behind everything */}
        <div className="ambient-bg" aria-hidden>
          <div className="ambient-blob ambient-blob-1" />
          <div className="ambient-blob ambient-blob-2" />
          <div className="ambient-blob ambient-blob-3" />
          <div className="ambient-blob ambient-blob-4" />
          <div className="energy-sweep" />
          <div className="animated-grid" />
          <div className="ambient-vignette" />
          <div className="scanlines" />
        </div>
        {/* Cursor glow */}
        <div
          className="cursor-glow"
          aria-hidden
          style={{ background: `radial-gradient(620px circle at ${glow.x}px ${glow.y}px, rgba(14,165,233,0.08), transparent 70%)` }}
        />

        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Desktop header */}
          <div className="hidden md:flex items-stretch">
            <div className="flex-1 min-w-0"><HeaderBar /></div>
            <div className="flex items-center pl-3 pr-5 flex-shrink-0" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
              <ClockCalendar />
            </div>
          </div>

          {/* Mobile top bar */}
          <div
            className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-[56px]"
            style={{
              background: 'rgba(4,4,15,0.95)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors active:scale-95"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Logo — mix-blend-mode removes white background */}
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center"
                style={{ background: 'transparent' }}
              >
                <Image
                  src="/logo.png"
                  alt="Vision Collegiate"
                  width={28}
                  height={28}
                  className="object-contain logo-blend"
                />
              </div>
              <span className="text-sm font-bold text-white">Vision Collegiate</span>
            </div>

            <div className="w-[40px]" />
          </div>

          {/* Mobile clock row — below the top bar */}
          <div className="md:hidden flex justify-end px-4 pt-2">
            <ClockCalendar />
          </div>

          {/* Page content — cinematic route transition */}
          <main className="flex-1 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 18, scale: 0.985, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -14, scale: 0.99, filter: 'blur(6px)' }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}