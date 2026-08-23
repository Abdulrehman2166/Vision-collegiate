'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/utils/auth';
import { Sidebar } from './Sidebar';
import { PageLoader } from '@/components/ui/Loading';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Wraps all authenticated pages.
 * Redirects to /login if no token is found client-side.
 */
export function AppShell({ children }: AppShellProps) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return <PageLoader />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
