import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark:    '#0f0f1a',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-mesh':   'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      },
      boxShadow: {
        'glow-sm':  '0 0 15px -3px rgba(99,102,241,0.25)',
        'glow':     '0 0 25px -5px rgba(99,102,241,0.35)',
        'glow-lg':  '0 0 40px -8px rgba(99,102,241,0.45)',
        'glow-green': '0 0 20px -4px rgba(16,185,129,0.3)',
        'glow-red':   '0 0 20px -4px rgba(239,68,68,0.3)',
        'card':     '0 1px 3px rgba(0,0,0,0.05), 0 4px 24px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 8px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.1)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backdropBlur: {
        xs: '2px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in':      'fadeIn 0.25s ease-out',
        'slide-up':     'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
        'slide-in':     'slideIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':     'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
        'pulse-glow':   'pulseGlow 2s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'float':        'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        slideIn: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px -3px rgba(99,102,241,0.3)' },
          '50%':      { boxShadow: '0 0 30px -3px rgba(99,102,241,0.6)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
