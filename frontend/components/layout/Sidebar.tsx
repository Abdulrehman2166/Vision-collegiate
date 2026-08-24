'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, BookOpen, CalendarCheck, BarChart3,
  MessageSquare, LogOut, GraduationCap, X, ChevronLeft,
  ChevronRight, ShieldCheck,
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
];

// ─── Nav item component ────────────────────────────────────────────────────────
function NavItem({
  item, active, collapsed, onClick,
}: {
  item: typeof NAV[0];
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <motion.div whileHover={{ x: collapsed ? 0 : 2 }} transition={{ duration: 0.15 }}>
      <Link
        href={item.href}
        onClick={onClick}
        title={collapsed ? item.label : undefined}
        className={clsx(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group select-none',
          collapsed ? 'justify-center px-2' : '',
          active
            ? 'text-white'
            : 'text-slate-400 dark:text-slate-500 hover:text-white',
        )}
      >
        {/* Active background */}
        {active && (
          <motion.div
            layoutId="nav-active-bg"
            className="absolute inset-0 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${item.color}22, ${item.color}14)`,
              border: `1px solid ${item.color}30`,
            }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        {/* Hover background */}
        {!active && (
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          />
        )}

        {/* Icon */}
        <div
          className={clsx(
            'relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
            'transition-all duration-200',
            active ? 'scale-100' : 'scale-95 group-hover:scale-100',
          )}
          style={{
            background: active ? `${item.color}22` : 'transparent',
            boxShadow: active ? `0 0 12px -2px ${item.color}60` : 'none',
          }}
        >
          <Icon
            className="w-4 h-4 transition-transform duration-200 group-hover:scale-110"
            style={{ color: active ? item.color : 'currentColor' }}
          />
        </div>

        {/* Label */}
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
              className="text-sm font-semibold truncate relative z-10"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Active indicator dot */}
        {active && !collapsed && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-3 w-1.5 h-1.5 rounded-full z-10"
            style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }}
          />
        )}
      </Link>
    </motion.div>
  );
}

// ─── Main Sidebar ──────────────────────────────────────────────────────────────
interface SidebarProps { open?: boolean; onClose?: () => void; }

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [logoError, setLogoError]  = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getUser();

  async function logout() {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    clearAuth();
    toast.success('Signed out successfully');
    onClose?.();
    router.push('/login');
  }

  const visible = NAV.filter((n) => !user || n.roles.includes(user.role));
  const w = collapsed ? 72 : 260;

  const inner = (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      style={{
        background: 'linear-gradient(180deg, #080820 0%, #06061a 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        width: w,
        transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Ambient glow top-left */}
      <div
        className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)', transform: 'translate(-30%, -30%)' }}
      />

      {/* ── Logo header ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo */}
          <motion.div
            className="relative flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 0 20px -4px rgba(99,102,241,0.4)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{ boxShadow: ['0 0 16px -4px rgba(99,102,241,0.3)', '0 0 24px -3px rgba(139,92,246,0.5)', '0 0 16px -4px rgba(99,102,241,0.3)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {!logoError ? (
              <Image
                src="/logo.png"
                alt="Vision Collegiate"
                width={36}
                height={36}
                className="object-contain p-0.5"
                onError={() => setLogoError(true)}
                priority
              />
            ) : (
              <GraduationCap className="w-5 h-5 text-brand-400" />
            )}
          </motion.div>

          {/* Name */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="min-w-0"
              >
                <p className="text-sm font-black text-white leading-tight tracking-tight truncate">Vision Collegiate</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Online</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.06] transition-all"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
              <ChevronLeft className="w-4 h-4" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-0.5 scrollbar-thin">
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

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div
        className="p-2.5 flex-shrink-0 space-y-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* User card */}
        <AnimatePresence>
          {!collapsed && user && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="px-3 py-2.5 rounded-xl mb-1"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center gap-2.5">
                {/* Avatar with gradient */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    boxShadow: '0 0 10px -2px rgba(99,102,241,0.5)',
                  }}
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign out */}
        <motion.button
          onClick={logout}
          title={collapsed ? 'Sign Out' : undefined}
          whileHover={{ x: collapsed ? 0 : 2 }}
          className={clsx(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl',
            'text-sm font-semibold text-slate-500',
            'hover:bg-red-500/10 hover:text-red-400',
            'transition-all duration-200 group',
            collapsed && 'justify-center',
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0 group-hover:-translate-x-0.5 transition-transform duration-200" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div
        className="hidden md:block flex-shrink-0"
        style={{ width: w, transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div className="sticky top-0 h-screen overflow-hidden">{inner}</div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={onClose}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
