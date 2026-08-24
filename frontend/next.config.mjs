/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── SWC compiler (already default in Next 14, but explicit for clarity) ─
  swcMinify: true,

  // ── Compiler optimisations ─────────────────────────────────────────────
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // ── Image optimisation ─────────────────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],  // serve next-gen formats
    minimumCacheTTL: 86400,                 // cache optimised images for 24 h
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },

  // ── Experimental: partial prerendering hints ───────────────────────────
  experimental: {
    optimizePackageImports: [
      'lucide-react',      // tree-shake icon library (big win)
      'framer-motion',     // tree-shake motion exports
      'recharts',          // tree-shake chart components
      'date-fns',          // tree-shake date helpers
    ],
  },

  // ── API proxy — rewrites /api/v1/* to the backend ─────────────────────
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },

  // ── Security headers ───────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Long-cache static assets
        source: '/icons/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/logo.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default nextConfig;
