'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Bell, ChevronRight, Command, X,
  Users, CalendarCheck, BookOpen, BarChart3,
  LayoutDashboard, GraduationCap, MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { getUser } from '@/utils/auth';
import { clsx } from 'clsx';

// ─── Breadcrumb config ─────────────────────────────────────────────────────
const CRUMBS: Record<string, { label: string; icon: React.ReactNode }> = {
  '/dashboard':  { label: 'Dashboard',  icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  '/students':   { label: 'Students',   icon: <Users className="w-3.5 h-3.5" /> },
  '/batches':    { label: 'Batches',    icon: <GraduationCap className="w-3.5 h-3.5" /> },
  '/attendance': { label: 'Attendance', icon: <CalendarCheck className="w-3.5 h-3.5" /> },
  '/tests':      { label: 'Tests',      icon: <BookOpen className="w-3.5 h-3.5" /> },
  '/analytics':  { label: 'Analytics',  icon: <BarChart3 className="w-3.5 h-3.5" /> },
  '/users':      { label: 'Users',      icon: <Users className="w-3.5 h-3.5" /> },
  '/whatsapp':   { label: 'WhatsApp',   icon: <MessageSquare className="w-3.5 h-3.5" /> },
};

// Quick search items
const SEARCH_ITEMS = Object.entries(CRUMBS).map(([href, { label, icon }]) => ({ href, label, icon }));

// ─── Notification mock ─────────────────────────────────────────────────────
const NOTIFS = [
  { id: 1, text: 'Attendance marked for Batch A', time: '2m ago',  dot: 'bg-brand-500', unread: true },
  { id: 2, text: '3 students below 75% attendance', time: '15m ago', dot: 'bg-amber-500', unread: true },
  { id: 3, text: 'Test paper generated successfully', time: '1h ago', dot: 'bg-emerald-500', unread: false },
];

export function HeaderBar() {
  const pathname = usePathname();
  const user     = getUser();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query,      setQuery]      = useState('');
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [unread,     setUnread]     = useState(NOTIFS.filter(n => n.unread).length);

  const searchRef  = useRef<HTMLInputElement>(null);
  const notifsRef  = useRef<HTMLDivElement>(null);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
      if (e.key === 'Escape') { setSearchOpen(false); setNotifsOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  // Close notifs on outside click
  useEffect(() => {
    if (!notifsOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node))
        setNotifsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifsOpen]);

  // Build breadcrumbs
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const cfg  = CRUMBS[href];
    return { href, label: cfg?.label ?? seg.charAt(0).toUpperCase() + seg.slice(1), icon: cfg?.icon };
  });

  const filtered = query.trim()
    ? SEARCH_ITEMS.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : SEARCH_ITEMS;

  return (
    <>
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30
                         bg-white/90 dark:bg-[#09091c]/90 backdrop-blur-xl
                         border-b border-slate-200/60 dark:border-white/[0.05]
                         flex items-center gap-4 px-4 sm:px-6 h-[60px]">

        {/* Breadcrumbs */}
        <nav className="hidden sm:flex items-center gap-1.5 text-sm min-w-0 flex-1">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors font-medium">
            Home
          </Link>
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 flex-shrink-0" />
              {i === crumbs.length - 1 ? (
                <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white min-w-0">
                  {c.icon && <span className="text-brand-500 flex-shrink-0">{c.icon}</span>}
                  <span className="truncate">{c.label}</span>
                </span>
              ) : (
                <Link href={c.href} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors min-w-0">
                  {c.icon && <span className="flex-shrink-0">{c.icon}</span>}
                  <span className="truncate">{c.label}</span>
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Mobile: current page title */}
        <div className="sm:hidden flex-1 min-w-0">
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {crumbs[crumbs.length - 1]?.label ?? 'Dashboard'}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                       bg-slate-100 dark:bg-white/[0.05]
                       border border-slate-200/60 dark:border-white/[0.06]
                       text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
                       text-xs font-medium transition-all hover:bg-slate-200 dark:hover:bg-white/[0.08]"
            title="Search (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold
                            bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/[0.1]">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>

          {/* Notifications */}
          <div ref={notifsRef} className="relative">
            <button
              onClick={() => { setNotifsOpen(o => !o); if (notifsOpen) setUnread(0); }}
              className="relative p-2 rounded-xl
                         text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
                         hover:bg-slate-100 dark:hover:bg-white/[0.05]
                         transition-all duration-150"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-[#09091c]"
                />
              )}
            </button>

            <AnimatePresence>
              {notifsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0,  scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.18, ease: [0.16,1,0.3,1] }}
                  className="absolute right-0 top-11 w-80 rounded-2xl overflow-hidden z-50
                             bg-white dark:bg-[#111128]
                             border border-slate-200/60 dark:border-white/[0.08]
                             shadow-modal"
                >
                  <div className="flex items-center justify-between px-4 py-3
                                  border-b border-slate-100 dark:border-white/[0.06]">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Notifications</span>
                    <button
                      onClick={() => setUnread(0)}
                      className="text-xs text-brand-500 hover:text-brand-400 font-semibold"
                    >
                      Mark all read
                    </button>
                  </div>
                  {NOTIFS.map(n => (
                    <div key={n.id}
                         className={clsx(
                           'flex items-start gap-3 px-4 py-3 transition-colors',
                           n.unread ? 'bg-brand-50/50 dark:bg-brand-500/[0.04]' : '',
                           'hover:bg-slate-50 dark:hover:bg-white/[0.02]',
                         )}>
                      <span className={clsx('mt-1.5 w-2 h-2 rounded-full flex-shrink-0', n.dot)} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{n.text}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600
                          flex items-center justify-center text-white text-sm font-black
                          shadow-glow-sm cursor-default select-none"
               title={user?.name}>
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
        </div>
      </header>

      {/* ── Spotlight Search ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)' }}
            onClick={e => { if (e.target === e.currentTarget) setSearchOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -16 }}
              animate={{ scale: 1,    opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -16 }}
              transition={{ duration: 0.2, ease: [0.16,1,0.3,1] }}
              className="w-full max-w-xl rounded-2xl overflow-hidden shadow-modal
                         bg-white dark:bg-[#111128]
                         border border-slate-200/60 dark:border-white/[0.08]"
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3.5
                              border-b border-slate-200/60 dark:border-white/[0.06]">
                <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search pages…"
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white
                             placeholder:text-slate-400 outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="px-2 py-1 text-[10px] font-bold rounded-md text-slate-400
                                bg-slate-100 dark:bg-white/[0.06] border border-slate-300 dark:border-white/10">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="py-2 max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-400 text-center">No results found</p>
                ) : (
                  filtered.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5
                                 hover:bg-brand-50/50 dark:hover:bg-brand-500/[0.08]
                                 transition-colors group"
                    >
                      <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.06]
                                       flex items-center justify-center
                                       text-slate-500 dark:text-slate-400
                                       group-hover:bg-brand-100 dark:group-hover:bg-brand-500/20
                                       group-hover:text-brand-600 dark:group-hover:text-brand-400
                                       transition-colors flex-shrink-0">
                        {item.icon}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300
                                       group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                        {item.label}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 ml-auto
                                               group-hover:text-brand-400 transition-colors" />
                    </Link>
                  ))
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/[0.05]
                              flex items-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 font-mono">↑↓</kbd>navigate</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 font-mono">↵</kbd>open</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 font-mono">esc</kbd>close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
