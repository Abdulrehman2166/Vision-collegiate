'use client';
import { useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, BookOpen, CalendarCheck, BarChart3,
  MessageSquare, LogOut, GraduationCap, X, ChevronLeft,
  ChevronRight, Settings,
} from 'lucide-react';
import { clearAuth, getUser } from '@/utils/auth';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import toast from 'react-hot-toast';

// ─── Collapse context ──────────────────────────────────────────────────────
export const SidebarCtx = createContext({ collapsed: false });
export function useSidebar() { return useContext(SidebarCtx); }

// ─── Nav items ─────────────────────────────────────────────────────────────
const NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, roles: ['admin','teacher','parent','student'] },
  { href: '/students',   label: 'Students',   icon: Users,           roles: ['admin','teacher'] },
  { href: '/batches',    label: 'Batches',    icon: GraduationCap,   roles: ['admin','teacher'] },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck,   roles: ['admin','teacher'] },
  { href: '/tests',      label: 'Tests',      icon: BookOpen,        roles: ['admin','teacher','parent','student'] },
  { href: '/analytics',  label: 'Analytics',  icon: BarChart3,       roles: ['admin','teacher'] },
  { href: '/users',      label: 'Users',      icon: Users,           roles: ['admin'] },
  { href: '/whatsapp',   label: 'WhatsApp',   icon: MessageSquare,   roles: ['admin'] },
];

interface SidebarProps { open?: boolean; onClose?: () => void; }

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getUser();

  async function logout() {
    try { await api.post('/auth/logout'); } catch {}
    clearAuth();
    router.push('/login');
    toast.success('Signed out');
    onClose?.();
  }

  const visible = NAV.filter(n => !user || n.roles.includes(user.role));
  const w = collapsed ? 72 : 260;

  const inner = (
    <motion.aside
      animate={{ width: w }}
      transition={{ duration: 0.25, ease: [0.16,1,0.3,1] }}
      className="flex flex-col h-full overflow-hidden
                 bg-white dark:bg-[#09091c]
                 border-r border-slate-200/70 dark:border-white/[0.05]"
      style={{ width: w }}
    >
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-5
                      border-b border-slate-200/70 dark:border-white/[0.05]">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon */}
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                            flex items-center justify-center shadow-glow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                         opacity-20 blur-md -z-10"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="min-w-0"
              >
                <p className="text-sm font-black text-slate-900 dark:text-white leading-tight tracking-tight">Vision</p>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Collegiate</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onClose && (
            <button onClick={onClose} className="md:hidden p-1.5 rounded-lg btn-ghost">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden md:flex p-1.5 rounded-lg btn-ghost"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-0.5">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-700">
            Menu
          </p>
        )}

        {visible.map(item => {
          const Icon   = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl',
                'text-sm font-semibold transition-all duration-150 group',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-glow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]',
              )}
            >
              <Icon className={clsx(
                'w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110',
                active ? 'text-white' : '',
              )} />

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {active && !collapsed && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/60" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User card ────────────────────────────────────────────── */}
      <div className="p-2.5 border-t border-slate-200/70 dark:border-white/[0.05] space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03]
                          border border-slate-200/60 dark:border-white/[0.05]">
            <div className="flex items-center gap-2.5">
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
          onClick={logout}
          title="Sign Out"
          className={clsx(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl',
            'text-sm font-semibold text-slate-500 dark:text-slate-500',
            'hover:bg-red-50 dark:hover:bg-red-500/10',
            'hover:text-red-600 dark:hover:text-red-400',
            'transition-all duration-150 group',
            collapsed && 'justify-center',
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0 group-hover:-translate-x-0.5 transition-transform" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block flex-shrink-0" style={{ width: w, transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
        <div className="sticky top-0 h-screen">{inner}</div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}
              className="absolute left-0 top-0 bottom-0 w-[260px] shadow-2xl"
            >
              {inner}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
