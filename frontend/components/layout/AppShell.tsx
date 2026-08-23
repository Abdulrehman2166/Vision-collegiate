'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getUser } from '@/utils/auth';
import { Sidebar } from './Sidebar';
import { PageLoader } from '@/components/ui/Loading';
import { Menu, GraduationCap } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready,      setReady]      = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!ready) return <PageLoader />;

  const user = getUser();

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Mobile top bar ── */}
        <header className="md:hidden sticky top-0 z-40 bg-white dark:bg-slate-900
                           border-b border-slate-200 dark:border-slate-700
                           flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">Vision Collegiate</span>
          </div>

          <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30
                          flex items-center justify-center text-brand-700 dark:text-brand-300
                          text-sm font-bold">
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
