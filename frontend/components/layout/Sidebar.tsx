'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, BookOpen, CalendarCheck, BarChart3,
  MessageSquare, LogOut, GraduationCap, X, ChevronLeft,
  ShieldCheck, Settings,
} from 'lucide-react';
import { clearAuth, getUser } from '@/utils/auth';
import api from '@/utils/api';
import toast from 'react-hot-toast';

// ─── Nav items ─────────────────────────────────────────────────────────────────
const NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, roles: ['admin','teacher','parent','student'], color: '#6366f1' },
  { href: '/students',   label: 'Students',   icon: Users,           roles: ['admin','teacher'],                    color: '#06b6d4' },
  { href: '/batches',    label: 'Batches',    icon: GraduationCap,   roles: ['admin','teacher'],                    color: '#a855f7' },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck,   roles: ['admin','teacher'],                    color: '#10b981' },
  { href: '/tests',      label: 'Tests',      icon: BookOpen,        roles: ['admin','teacher','parent','student'], color: '#f59e0b' },
  { href: '/analytics',  label: 'Analytics',  icon: BarChart3,       roles: ['admin','teacher'],                    color: '#f43f5e' },
  { href: '/users',      label: 'Users',      icon: ShieldCheck,     roles: ['admin'],                              color: '#8b5cf6' },
  { href: '/whatsapp',   label: 'WhatsApp',   icon: MessageSquare,   roles: ['admin'],                              color: '#22c55e' },
  { href: '/settings',   label: 'Settings',   icon: Settings,        roles: ['admin'],                              color: '#94a3b8' },
];

// ─── Nav item — memoised so it only re-renders when active state changes ───────
const NavItem = memo(function NavItem({
  item, active, collapsed, onClick,
}: {
  item: typeof NAV[0];
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={clsx(
        // Pure CSS transition — no Framer motion wrapper here for performance
        'nav-item relative flex items-center gap-3 px-3 py-2.5 rounded-xl',
        'transition-colors duration-150 group select-none',
        collapsed ? 'justify-center px-2' : '',
        active ? 'nav-item-active text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]',
      )}
      style={active ? {
        background: `linear-gradient(135deg, ${item.color}1a, ${item.color}0f)`,
        border: `1px solid ${item.color}28`,
      } : { border: '1px solid transparent' }}
    >
      {/* Icon container */}
      <span
        className="relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
        style={active ? {
          background: `${item.color}1a`,
          boxShadow: `0 0 10px -3px ${item.color}70`,
        } : {}}
      >
        <Icon
          className="w-4 h-4"
          style={{ color: active ? item.color : 'currentColor' }}
        />
      </span>

      {/* Label — CSS opacity transition, no AnimatePresence overhead */}
      <span
        className={clsx(
          'text-sm font-semibold truncate relative z-10',
          'transition-[opacity,transform] duration-150',
          collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
        )}
      >
        {item.label}
      </span>

      {/* Active dot */}
      {active && !collapsed && (
        <span
          className="absolute right-3 w-1.5 h-1.5 rounded-full"
          style={{ background: item.color, boxShadow: `0 0 5px ${item.color}` }}
        />
      )}
    </Link>
  );
});

// ─── Main Sidebar ──────────────────────────────────────────────────────────────
interface SidebarProps { open?: boolean; onClose?: () => void; }

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getUser();

  async function logout() {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    clearAuth();
    toast.success('Signed out');
    onClose?.();
    router.push('/login');
  }

  const visible = NAV.filter((n) => !user || n.roles.includes(user.role));
  const w = collapsed ? 72 : 260;

  const inner = (
    <div
      className="flex flex-col h-full overflow-hidden relative sidebar-bg"
      style={{ width: w, transition: 'width 0.22s cubic-bezier(0.16,1,0.3,1)' }}
    >
      {/* ── Logo header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-4 flex-shrink-0 sidebar-border-b">
        <div className="flex items-center gap-3 min-w-0">

          {/* Logo — mix-blend-mode:screen makes the white background invisible on dark bg */}
          <div
            className="relative flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center logo-glow"
            style={{ background: 'rgba(255,255,255,0.0)' }}
          >
            <Image
              src="/logo.png"
              alt="Vision Collegiate"
              width={40}
              height={40}
              className="object-contain logo-blend"
              priority
            />
          </div>

          {/* Brand name — CSS opacity/transform, no AnimatePresence */}
          <div
            className={clsx(
              'min-w-0 transition-[opacity,width] duration-200 overflow-hidden',
              collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto',
            )}
          >
            <p className="text-sm font-black text-white leading-tight tracking-tight whitespace-nowrap">Vision Collegiate</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-dot" />
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Online</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onClose && (
            <button onClick={onClose} className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.06] transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeft
              className="w-4 h-4 transition-transform duration-220"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-0.5">
        {!collapsed && (
          <p className="px-3 mb-3 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
            Navigation
          </p>
        )}
        {visible.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
            collapsed={collapsed}
            onClick={onClose}
          />
        ))}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="p-2.5 flex-shrink-0 space-y-1 sidebar-border-t">
        {/* User card */}
        {!collapsed && user && (
          <div
            className="px-3 py-2.5 rounded-xl mb-1"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
              >
                {user.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{user.name}</p>
                <p className="text-[10px] font-medium text-slate-500 capitalize mt-0.5 truncate">
                  {user.role === 'admin' ? '⚡ Administrator' : user.role === 'teacher' ? '🎓 Teacher' : user.role}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={logout}
          title={collapsed ? 'Sign Out' : undefined}
          className={clsx(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl',
            'text-sm font-semibold text-slate-500',
            'hover:bg-red-500/10 hover:text-red-400',
            'transition-colors duration-150',
            collapsed && 'justify-center',
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop — no wrapper animation, just CSS width transition */}
      <div
        className="hidden md:block flex-shrink-0"
        style={{ width: w, transition: 'width 0.22s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div className="sticky top-0 h-screen overflow-hidden">{inner}</div>
      </div>

      {/* Mobile drawer — only Framer Motion here (conditional mount) */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
              onClick={onClose}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-0 bottom-0 w-[260px] shadow-2xl overflow-hidden"
            >
              {inner}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
