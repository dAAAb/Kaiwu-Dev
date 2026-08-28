/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design tokens — see DESIGN.md
        bg: '#0A0E1A',
        surface: { DEFAULT: '#111827', 2: '#182135' },
        line: { DEFAULT: 'rgba(148,163,184,0.14)', strong: 'rgba(148,163,184,0.28)' },
        fg: { DEFAULT: '#E8EDF5', muted: '#A3AFC2', subtle: '#7C8AA3' },
        accent: { DEFAULT: '#F59E0B', hover: '#FBBF24', soft: 'rgba(245,158,11,0.12)' },
        filament: { DEFAULT: '#38BDF8', soft: 'rgba(56,189,248,0.12)' },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        // Legacy aliases (existing dashboard markup)
        border: 'rgba(148,163,184,0.14)',
        muted: '#A3AFC2',
        accent2: '#38BDF8',
      },
      fontFamily: {
        sans: ['Inter', 'Inter Fallback', 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        display: ['clamp(2.5rem, 1.6rem + 3.4vw, 4.5rem)', { lineHeight: '1.15' }],
        h1: ['clamp(1.875rem, 1.3rem + 2.2vw, 3rem)', { lineHeight: '1.2' }],
        h2: ['clamp(1.5rem, 1.2rem + 1.1vw, 2.125rem)', { lineHeight: '1.25' }],
        h3: ['1.25rem', { lineHeight: '1.35' }],
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        fadeUp: 'fadeUp .5s ease-out both',
      },
    },
  },
  plugins: [],
}
