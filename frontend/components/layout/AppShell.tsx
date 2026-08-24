'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/utils/auth';
import { Sidebar } from './Sidebar';
import { HeaderBar } from './HeaderBar';
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
    if (!isAuthenticated()) { router.replace('/login'); } else { setReady(true); }
  }, [router]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (!ready) return <PageLoader />;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0a0a1e]">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Desktop header */}
        <div className="hidden md:block">
          <HeaderBar />
        </div>

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-40
                        bg-white/90 dark:bg-[#09091c]/90 backdrop-blur-xl
                        border-b border-slate-200/60 dark:border-white/[0.05]
                        flex items-center justify-between px-4 h-[56px]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.06]
                       text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.1]
                       transition-all"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Logo center */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600
                            flex items-center justify-center shadow-glow-sm">
              <span className="text-xs font-black text-white">V</span>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">Vision Collegiate</span>
          </div>

          {/* Spacer (keep title centered) */}
          <div className="w-10" />
        </div>

        {/* Page content with page-transition animation */}
        <main className="flex-1 overflow-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16,1,0.3,1] }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
