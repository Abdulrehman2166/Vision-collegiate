'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, BookOpen, CalendarCheck,
  FileText, BarChart3, MessageSquare, LogOut, GraduationCap,
} from 'lucide-react';
import { clearAuth, getUser } from '@/utils/auth';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import toast from 'react-hot-toast';

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, roles: ['admin','teacher','parent','student'] },
  { href: '/students',   label: 'Students',   icon: Users,           roles: ['admin','teacher'] },
  { href: '/batches',    label: 'Batches',    icon: GraduationCap,   roles: ['admin','teacher'] },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck,   roles: ['admin','teacher'] },
  { href: '/tests',      label: 'Tests',      icon: BookOpen,        roles: ['admin','teacher','parent','student'] },
  { href: '/analytics',  label: 'Analytics',  icon: BarChart3,       roles: ['admin','teacher'] },
  { href: '/users',      label: 'Users',      icon: Users,           roles: ['admin'] },
  { href: '/whatsapp',   label: 'WhatsApp',   icon: MessageSquare,   roles: ['admin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getUser();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    clearAuth();
    router.push('/login');
    toast.success('Logged out');
  }

  const visibleItems = navItems.filter(
    (item) => !user || item.roles.includes(user.role),
  );

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white dark:bg-slate-900
                      border-r border-slate-200 dark:border-slate-700">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Vision</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">Collegiate</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon    = item.icon;
          const active  = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700">
        {user && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium
                     text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20
                     hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
