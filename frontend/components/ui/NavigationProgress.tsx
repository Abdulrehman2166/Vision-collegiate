'use client';

/**
 * NavigationProgress — slim top-of-page loading bar that fires on every
 * Next.js client-side route transition. Uses the App Router's built-in
 * `usePathname` + `useEffect` pattern (no external NProgress dependency).
 */
import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export function NavigationProgress() {
  const pathname   = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible,  setVisible]  = useState(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPath   = useRef(pathname);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    // Clear any running animation
    if (timerRef.current)   clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Start loading
    setProgress(0);
    setVisible(true);

    // Fast ramp to 85%, then hold
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += Math.random() * 12 + 4;
      if (p >= 85) {
        p = 85;
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
      setProgress(p);
    }, 80);

    // On next paint, jump to 100 and fade out
    timerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      timerRef.current = setTimeout(() => setVisible(false), 350);
    }, 380);

    return () => {
      if (timerRef.current)    clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="progress-bar"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] pointer-events-none"
          style={{ background: 'transparent' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #6366f1, #a855f7, #6366f1)',
              backgroundSize: '200% 100%',
              boxShadow: '0 0 10px rgba(99,102,241,0.7), 0 0 20px rgba(139,92,246,0.4)',
              transition: 'width 0.12s ease',
            }}
            animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
          {/* Leading glow dot */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
            style={{
              left: `calc(${progress}% - 6px)`,
              background: 'radial-gradient(circle, #a855f7, #6366f1)',
              boxShadow: '0 0 8px 2px rgba(139,92,246,0.8)',
              transition: 'left 0.12s ease',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
