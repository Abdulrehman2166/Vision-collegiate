import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe',
          300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1',
          600: '#4f46e5', 700: '#4338ca', 800: '#3730a3',
          900: '#312e81', 950: '#1e1b4b',
        },
        surface: '#0d0d1f',
        'surface-2': '#13132b',
        'surface-3': '#1a1a38',
      },
      boxShadow: {
        'glow':     '0 0 24px -4px rgba(99,102,241,0.45)',
        'glow-sm':  '0 0 12px -3px rgba(99,102,241,0.3)',
        'glow-lg':  '0 0 48px -8px rgba(99,102,241,0.55)',
        'glow-green': '0 0 20px -4px rgba(16,185,129,0.35)',
        'glow-red':   '0 0 20px -4px rgba(239,68,68,0.35)',
        'card':     '0 1px 2px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.1), 0 20px 40px rgba(0,0,0,0.12)',
        'modal':    '0 32px 80px rgba(0,0,0,0.5)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-up':   'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-in':   'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':   'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
        'shimmer':    'shimmer 1.8s linear infinite',
        'float':      'float 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'spin-slow':  'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideIn:   { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        slideDown: { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        scaleIn:   { from: { transform: 'scale(0.94)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        shimmer:   { from: { backgroundPosition: '-400% 0' }, to: { backgroundPosition: '400% 0' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-5px)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 16px -4px rgba(99,102,241,0.3)' }, '50%': { boxShadow: '0 0 32px -4px rgba(99,102,241,0.7)' } },
      },
    },
  },
  plugins: [],
};
export default config;
