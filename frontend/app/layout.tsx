import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { NavigationProgress } from '@/components/ui/NavigationProgress';

// ── next/font/google: self-hosted by Next.js, zero network request to Google,
//    automatic font-display:swap, no @next/next/no-page-custom-font warning ──
const inter = Inter({
  subsets: ['latin'],
  axes: ['opsz'],          // optical size axis (ital handled by variable font)
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#4f46e5' },
    { media: '(prefers-color-scheme: light)', color: '#4f46e5' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default:  'Vision Collegiate',
    template: '%s — Vision Collegiate',
  },
  description: 'Coaching Institute Management System — Attendance, Tests & Analytics',
  applicationName: 'Vision Collegiate',
  keywords: ['coaching', 'institute', 'attendance', 'tests', 'analytics'],
  authors: [{ name: 'Vision Collegiate' }],
  manifest: '/manifest.json',
  icons: {
    icon:  [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    other: [{ rel: 'mask-icon', url: '/icon-192.png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vision Collegiate',
  },
  openGraph: {
    title:       'Vision Collegiate',
    description: 'Coaching Institute Management System',
    type:        'website',
    locale:      'en_IN',
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Apply font CSS variable + className so Inter loads on every route
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body className={inter.className}>
        {/* Global route-change progress bar */}
        <NavigationProgress />

        {children}

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(10,10,28,0.97)',
              color: '#f1f5f9',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '14px',
              backdropFilter: 'blur(24px)',
              fontSize: '13px',
              fontWeight: '500',
              padding: '12px 16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
