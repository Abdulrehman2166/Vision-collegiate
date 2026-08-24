'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Bell, ChevronRight, Command, X,
  Users, CalendarCheck, BookOpen, BarChart3,
  LayoutDashboard, GraduationCap, MessageSquare,
  LogOut, Settings, User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth } from '@/utils/auth';
import api from '@/utils/api';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

// ─── Breadcrumb config ─────────────────────────────────────────────────────────
const CRUMBS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  '/dashboard':  { label: 'Dashboard',  icon: <LayoutDashboard className="w-3.5 h-3.5" />, color: '#6366f1' },
  '/students':   { label: 'Students',   icon: <Users           className="w-3.5 h-3.5" />, color: '#06b6d4' },
  '/batches':    { label: 'Batches',    icon: <GraduationCap   className="w-3.5 h-3.5" />, color: '#a855f7' },
  '/attendance': { label: 'Attendance', icon: <CalendarCheck   className="w-3.5 h-3.5" />, color: '#10b981' },
  '/tests':      { label: 'Tests',      icon: <BookOpen        className="w-3.5 h-3.5" />, color: '#f59e0b' },
  '/analytics':  { label: 'Analytics',  icon: <BarChart3       className="w-3.5 h-3.5" />, color: '#f43f5e' },
  '/users':      { label: 'Users',      icon: <Users           className="w-3.5 h-3.5" />, color: '#8b5cf6' },
  '/whatsapp':   { label: 'WhatsApp',   icon: <MessageSquare   className="w-3.5 h-3.5" />, color: '#22c55e' },
};

const SEARCH_ITEMS = Object.entries(CRUMBS).map(([href, { label, icon, color }]) => ({ href, label, icon, color }));

// ─── Notifications data ────────────────────────────────────────────────────────
const NOTIFS = [
  { id: 1, text: 'Attendance marked for Batch A',      time: '2m ago',   dot: '#6366f1', unread: true  },
  { id: 2, text: '3 students below 75% attendance',    time: '15m ago',  dot: '#f59e0b', unread: true  },
  { id: 3, text: 'Test paper generated successfully',  time: '1h ago',   dot: '#10b981', unread: false },
  { id: 4, text: 'WhatsApp blast sent to 42 parents',  time: '3h ago',   dot: '#22c55e', unread: false },
];

export function HeaderBar() {
  const pathname    = usePathname();
  const router      = useRouter();
  const user        = getUser();

  const [searchOpen,  setSearchOpen]  = useState(false);
  const [query,       setQuery]       = useState('');
  const [notifsOpen,  setNotifsOpen]  = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unread,      setUnread]      = useState(NOTIFS.filter((n) => n.unread).length);

  const searchRef  = useRef<HTMLInputElement>(null);
  const notifsRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen((o) => !o); }
      if (e.key === 'Escape') { setSearchOpen(false); setNotifsOpen(false); setProfileOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  // ── Outside click closers ────────────────────────────────────────────────
  useEffect(() => {
    if (!notifsOpen && !profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifsRef.current  && !notifsRef.current.contains(e.target as Node))  setNotifsOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifsOpen, profileOpen]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    clearAuth();
    toast.success('Signed out');
    router.push('/login');
  }, [router]);

  // ── Breadcrumbs ──────────────────────────────────────────────────────────
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const cfg  = CRUMBS[href];
    return { href, label: cfg?.label ?? (seg.charAt(0).toUpperCase() + seg.slice(1)), icon: cfg?.icon, color: cfg?.color };
  });
  const currentPage = crumbs[crumbs.length - 1];

  const filtered = query.trim()
    ? SEARCH_ITEMS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : SEARCH_ITEMS;

  const dropdownBase = clsx(
    'absolute right-0 top-12 rounded-2xl overflow-hidden z-50 shadow-modal',
    'border border-white/[0.08]',
  );
  const dropdownStyle = {
    background: 'rgba(8,8,28,0.97)',
    backdropFilter: 'blur(32px)',
    boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
  };
  const dropdownMotion = {
    initial: { opacity: 0, y: -8, scale: 0.96 },
    animate: { opacity: 1, y: 0,  scale: 1 },
    exit:    { opacity: 0, y: -8, scale: 0.96 },
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  };

  return (
    <>
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-4 px-4 sm:px-6 h-[60px]"
        style={{
          background: 'rgba(6,6,22,0.92)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Top shimmer line */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.3) 50%, transparent 100%)' }}
        />

        {/* Breadcrumbs */}
        <nav className="hidden sm:flex items-center gap-1.5 text-sm min-w-0 flex-1">
          <Link
            href="/dashboard"
            className="text-slate-500 hover:text-slate-200 transition-colors font-medium"
          >
            Home
          </Link>
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
              {i === crumbs.length - 1 ? (
                <span className="flex items-center gap-1.5 font-semibold text-white min-w-0">
                  {c.icon && (
                    <span className="flex-shrink-0" style={{ color: c.color ?? '#6366f1' }}>
                      {c.icon}
                    </span>
                  )}
                  <span className="truncate">{c.label}</span>
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 transition-colors min-w-0"
                >
                  {c.icon && <span className="flex-shrink-0">{c.icon}</span>}
                  <span className="truncate">{c.label}</span>
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Mobile: current page title */}
        <div className="sm:hidden flex-1 min-w-0 flex items-center gap-2">
          {currentPage?.icon && (
            <span style={{ color: currentPage.color ?? '#6366f1' }}>{currentPage.icon}</span>
          )}
          <span className="text-sm font-bold text-white truncate">
            {currentPage?.label ?? 'Dashboard'}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Search trigger */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                       text-slate-400 hover:text-white text-xs font-medium
                       transition-all duration-150"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
            title="Search (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd
              className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </motion.button>

          {/* Notifications */}
          <div ref={notifsRef} className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setNotifsOpen((o) => !o); setProfileOpen(false); }}
              className="relative p-2 rounded-xl text-slate-400 hover:text-white transition-all duration-150"
              style={{ background: notifsOpen ? 'rgba(255,255,255,0.06)' : 'transparent' }}
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-[#06061a]"
                  style={{
                    background: '#6366f1',
                    boxShadow: '0 0 6px rgba(99,102,241,0.8)',
                  }}
                />
              )}
            </motion.button>

            <AnimatePresence>
              {notifsOpen && (
                <motion.div {...dropdownMotion} className={clsx(dropdownBase, 'w-80')} style={dropdownStyle}>
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span className="text-sm font-bold text-white">Notifications</span>
                    <button
                      onClick={() => setUnread(0)}
                      className="text-xs font-semibold transition-colors"
                      style={{ color: '#6366f1' }}
                    >
                      Mark all read
                    </button>
                  </div>
                  {NOTIFS.map((n, i) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                      style={{
                        background: n.unread ? 'rgba(99,102,241,0.04)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = n.unread ? 'rgba(99,102,241,0.04)' : 'transparent'; }}
                    >
                      <span
                        className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: n.dot, boxShadow: `0 0 6px ${n.dot}80` }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200">{n.text}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{n.time}</p>
                      </div>
                      {n.unread && (
                        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ background: '#6366f1' }} />
                      )}
                    </motion.div>
                  ))}
                  <div className="px-4 py-2.5 text-center">
                    <span className="text-[11px] text-slate-600 font-medium">System notifications only</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Avatar + Profile dropdown */}
          <div ref={profileRef} className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setProfileOpen((o) => !o); setNotifsOpen(false); }}
              className="relative w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-black"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                boxShadow: profileOpen
                  ? '0 0 0 2px rgba(99,102,241,0.6), 0 0 16px rgba(99,102,241,0.4)'
                  : '0 0 12px -2px rgba(99,102,241,0.4)',
                outline: profileOpen ? '2px solid rgba(99,102,241,0.6)' : 'none',
                outlineOffset: '2px',
              }}
              title={user?.name}
              aria-label="Profile menu"
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              {/* Online indicator */}
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: '#10b981', borderColor: 'rgba(6,6,22,1)' }}
              />
            </motion.button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div {...dropdownMotion} className={clsx(dropdownBase, 'w-56')} style={dropdownStyle}>
                  {/* User info */}
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{user?.email}</p>
                    <span
                      className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                    >
                      {user?.role === 'admin' ? '⚡' : '🎓'} {user?.role}
                    </span>
                  </div>

                  {/* Menu items */}
                  {[
                    { icon: User,     label: 'Profile',       href: '/users'  },
                    { icon: Settings, label: 'Settings',       href: '/users'  },
                  ].map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  ))}

                  {/* Logout */}
                  <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ── Spotlight Search ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] flex items-start justify-center pt-[18vh] px-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: -20 }}
              animate={{ scale: 1,    opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: -20 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-xl rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(8,8,28,0.98)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {/* Top shimmer */}
              <div
                className="h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8), transparent)' }}
              />

              {/* Search input */}
              <div
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="text-slate-600 hover:text-slate-300 transition-colors p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd
                  className="px-2 py-1 text-[10px] font-bold rounded text-slate-500"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="py-2 max-h-72 overflow-y-auto">
                {!query.trim() && (
                  <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">
                    All Pages
                  </p>
                )}
                {filtered.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-slate-500 text-center">No pages found for &quot;{query}&quot;</p>
                ) : (
                  filtered.map((item, i) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors group"
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
                      >
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white transition-transform duration-150 group-hover:scale-110"
                          style={{ background: `${item.color}22`, border: `1px solid ${item.color}30` }}
                        >
                          <span style={{ color: item.color }}>{item.icon}</span>
                        </span>
                        <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">
                          {item.label}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 ml-auto transition-colors" />
                      </Link>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer hints */}
              <div
                className="px-4 py-2.5 flex items-center gap-4 text-[11px] text-slate-600"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                {[['↵', 'open'], ['ESC', 'close']].map(([key, label]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <kbd
                      className="px-1.5 py-0.5 rounded font-mono"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      {key}
                    </kbd>
                    {label}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
