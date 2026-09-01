'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { isAuthenticated } from '@/utils/auth';
import { Sidebar } from './Sidebar';
import { HeaderBar } from './HeaderBar';
import { ClockCalendar } from './ClockCalendar';
import { PageLoader } from '@/components/ui/Loading';
import { Menu } from 'lucide-react';
import { motion } from 'framer-motion';

interface AppShellProps { children: React.ReactNode; }

export function AppShell({ children }: AppShellProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready,       setReady]       = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
    else setReady(true);
  }, [router]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (!ready) return <PageLoader />;

  return (
    <div
      className="flex min-h-screen"
      style={{ background: 'linear-gradient(180deg, #04040f 0%, #06061a 100%)' }}
    >
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

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

        {/* Page content — fast, subtle transition for instant feel */}
        <main className="flex-1 overflow-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
