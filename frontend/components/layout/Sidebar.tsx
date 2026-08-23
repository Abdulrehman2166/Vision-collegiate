'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, BookOpen, CalendarCheck,
  BarChart3, MessageSquare, LogOut, GraduationCap, X,
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

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getUser();

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    clearAuth();
    router.push('/login');
    toast.success('Signed out');
    onClose?.();
  }

  const visibleItems = navItems.filter(
    (item) => !user || item.roles.includes(user.role),
  );

  const inner = (
    <aside className="flex flex-col h-full w-64
                      bg-white dark:bg-[#09091a]
                      border-r border-slate-200/80 dark:border-white/[0.05]">

      {/* ── Logo ── */}
      <div className="px-5 py-5 flex items-center justify-between
                      border-b border-slate-200/80 dark:border-white/[0.05]">
        <div className="flex items-center gap-3">
          {/* Icon with glow */}
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                            flex items-center justify-center shadow-glow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                            opacity-30 blur-sm -z-10" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white leading-tight tracking-tight">
              Vision
            </p>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-600 leading-tight uppercase tracking-widest">
              Collegiate
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                       hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {/* Section label */}
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest
                      text-slate-400 dark:text-slate-600">
          Navigation
        </p>

        {visibleItems.map((item) => {
          const Icon   = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={clsx(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold',
                'transition-all duration-150 group',
                active
                  ? [
                    'text-white',
                    'bg-gradient-to-r from-brand-600 to-brand-500',
                    'shadow-glow-sm',
                  ]
                  : [
                    'text-slate-600 dark:text-slate-400',
                    'hover:text-slate-900 dark:hover:text-white',
                    'hover:bg-slate-100/80 dark:hover:bg-white/[0.05]',
                  ],
              )}
            >
              {/* Active indicator dot */}
              {active && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2
                                 w-1.5 h-1.5 rounded-full bg-white/60" />
              )}
              <Icon className={clsx(
                'w-4 h-4 flex-shrink-0 transition-transform duration-150',
                'group-hover:scale-110',
                active ? 'text-white' : '',
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── User card + logout ── */}
      <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.05]">
        {user && (
          <div className="px-3 py-3 mb-2 rounded-xl
                          bg-slate-50 dark:bg-white/[0.03]
                          border border-slate-200/80 dark:border-white/[0.05]">
            <div className="flex items-center gap-2.5">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600
                              flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                {user.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-tight">
                  {user.name}
                </p>
                <p className="text-[10px] font-medium text-slate-400 capitalize mt-0.5">{user.role}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                     text-sm font-semibold text-slate-500 dark:text-slate-500
                     hover:bg-red-50 dark:hover:bg-red-500/10
                     hover:text-red-600 dark:hover:text-red-400
                     transition-all duration-150 group"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-150" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex md:w-64 md:flex-shrink-0 min-h-screen">
        {inner}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 shadow-2xl animate-slide-in">
            {inner}
          </div>
        </div>
      )}
    </>
  );
}
