/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e1a',
        surface: '#111827',
        border: '#1e293b',
        muted: '#94a3b8',
        accent: '#f59e0b',
        accent2: '#3b82f6',
      },
    },
  },
  plugins: [],
}
