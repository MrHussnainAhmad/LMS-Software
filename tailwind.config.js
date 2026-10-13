/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Canvas + paper */
        canvas: '#F5F4F1',
        surface: '#FFFFFF',
        sunken: '#FAF9F6',
        /* Ink */
        ink: '#1B2130',
        'ink-2': '#4B5364',
        'ink-3': '#7B8394',
        'ink-4': '#9AA1AF',
        /* Hairlines */
        line: '#E5E3DD',
        'line-2': '#D5D2CA',
        /* Navy rail */
        rail: '#131A2A',
        'rail-2': '#1B2436',
        'rail-3': '#28324A',
        'rail-ink': '#AEB6C6',
        'rail-ink-2': '#7A8497',
        /* Brand navy */
        brand: '#2C3A5C',
        'brand-2': '#1F2A45',
        'brand-soft': '#EDEFF5',
        /* Amber accent */
        accent: '#BE7B14',
        'accent-2': '#A46A0D',
        'accent-soft': '#FBF2E1',
        'accent-line': '#EBD6AC',
        /* Status */
        ok: '#14795A',
        'ok-soft': '#E7F4EE',
        warn: '#9C640C',
        'warn-soft': '#FBF1DF',
        bad: '#B0433D',
        'bad-soft': '#FAECEA',
        info: '#2C69AC',
        'info-soft': '#EAF1F9',
      },
      fontFamily: {
        sans: [
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"Cascadia Mono"', 'Consolas', '"SF Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        md: ['0.9375rem', { lineHeight: '1.4375rem' }],
        lg: ['1.0625rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.6rem' }],
        '2xl': ['1.5rem', { lineHeight: '1.85rem' }],
        '3xl': ['1.8125rem', { lineHeight: '2.1rem' }],
      },
      borderRadius: {
        sm: '5px',
        DEFAULT: '7px',
        md: '9px',
        lg: '11px',
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        hair: '0 1px 0 rgba(19,26,42,.035)',
        card: '0 1px 2px rgba(19,26,42,.04), 0 1px 3px -1px rgba(19,26,42,.07)',
        lift: '0 2px 4px rgba(19,26,42,.05), 0 8px 20px -10px rgba(19,26,42,.16)',
        pop: '0 10px 34px -8px rgba(19,26,42,.22), 0 2px 8px rgba(19,26,42,.06)',
        modal: '0 24px 70px -18px rgba(19,26,42,.36), 0 4px 12px rgba(19,26,42,.08)',
      },
      spacing: {
        rail: '248px',
        'rail-md': '216px',
        'rail-sm': '64px',
        topbar: '60px',
      },
      transitionDuration: {
        DEFAULT: '120ms',
        120: '120ms',
        180: '180ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(.32,.72,.36,1)',
        out: 'cubic-bezier(.22,.68,.28,1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(.985)' },
          to: { opacity: '1', transform: 'none' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: { to: { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .18s cubic-bezier(.22,.68,.28,1) both',
        'fade-in': 'fade-in .14s linear both',
        'scale-in': 'scale-in .16s cubic-bezier(.22,.68,.28,1) both',
        'slide-in-right': 'slide-in-right .18s cubic-bezier(.22,.68,.28,1) both',
      },
    },
  },
  plugins: [],
};
