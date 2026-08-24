import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { NavigationProgress } from '@/components/ui/NavigationProgress';

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
  robots: { index: false, follow: false }, // internal app — don't index
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
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
