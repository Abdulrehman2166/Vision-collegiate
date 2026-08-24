'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
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
  const [logoError,   setLogoError]   = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (!ready) return <PageLoader />;

  return (
    <div
      className="flex min-h-screen"
      style={{ background: 'linear-gradient(180deg, #04040f 0%, #06061a 100%)' }}
    >
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Desktop header */}
        <div className="hidden md:block">
          <HeaderBar />
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
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </motion.button>

          {/* Logo center */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 0 12px -2px rgba(99,102,241,0.5)',
              }}
            >
              {!logoError ? (
                <Image
                  src="/logo.png"
                  alt="Vision Collegiate"
                  width={28}
                  height={28}
                  className="object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-xs font-black text-white">V</span>
              )}
            </div>
            <span className="text-sm font-bold text-white">Vision Collegiate</span>
          </div>

          {/* Spacer to keep logo centered */}
          <div className="w-[40px]" />
        </div>

        {/* Page content with animated transitions */}
        <main className="flex-1 overflow-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
