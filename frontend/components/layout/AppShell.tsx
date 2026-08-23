'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getUser } from '@/utils/auth';
import { Sidebar } from './Sidebar';
import { PageLoader } from '@/components/ui/Loading';
import { Menu } from 'lucide-react';

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

  const user = getUser();

  // Page title from pathname
  const pageLabel: Record<string, string> = {
    '/dashboard': 'Dashboard', '/students': 'Students', '/batches': 'Batches',
    '/attendance': 'Attendance', '/tests': 'Tests', '/analytics': 'Analytics',
    '/users': 'Users', '/whatsapp': 'WhatsApp',
  };
  const currentLabel = Object.entries(pageLabel).find(([k]) => pathname.startsWith(k))?.[1] ?? '';

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#08081a]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Mobile top bar ── */}
        <header className="md:hidden sticky top-0 z-40
                           bg-white/90 dark:bg-[#09091a]/90 backdrop-blur-md
                           border-b border-slate-200/80 dark:border-white/[0.05]
                           flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.06]
                       text-slate-600 dark:text-slate-400
                       hover:bg-slate-200 dark:hover:bg-white/[0.1]
                       transition-all duration-150"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <span className="text-sm font-bold text-slate-900 dark:text-white">{currentLabel}</span>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                          flex items-center justify-center text-white text-sm font-black
                          shadow-glow-sm">
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
