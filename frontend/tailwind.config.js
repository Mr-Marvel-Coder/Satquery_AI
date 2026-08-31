/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: [
    // Dynamically assembled border-left accent classes used in metric cards
    'border-l-primary', 'border-l-accent', 'border-l-moss', 'border-l-ochre', 'border-l-carmine', 'border-l-rule2',
  ],
  theme: {
    extend: {
      colors: {
        /* Background surfaces — pure white */
        paper: '#FFFFFF',
        sheet: '#FFFFFF',
        wash:  '#F0F4FF', // very light blue-tinted hover/section backgrounds
        rule:  '#E2E8F0', // borders
        rule2: '#CBD5E1', // stronger borders

        /* Text — navy/dark-blue hierarchy */
        ink:  '#0D1B4B', // deep navy for headings & important text
        ink2: '#2C3E7A', // medium navy for secondary text
        ink3: '#6B7BAD', // muted blue-gray for metadata

        /* Primary brand: strong aerospace navy blue */
        primary: { DEFAULT: '#1A3270', deep: '#0D1B4B', soft: '#E8EEFF' },
        /* Accent: clear, clean blue */
        accent:  { DEFAULT: '#2563EB', deep: '#1D4ED8', soft: '#DBEAFE' },

        /* Functional legend colors */
        ochre:   { DEFAULT: '#D97706', deep: '#92400E', soft: '#FEF3C7' },
        carmine: { DEFAULT: '#E11D48', deep: '#9F1239', soft: '#FFE4E6' },
        moss:    { DEFAULT: '#059669', deep: '#065F46', soft: '#D1FAE5' },
      },
      fontFamily: {
        display: ['"Chonburi"', 'serif'],
        body:    ['"Domine"', 'serif'],
        sans:    ['"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm:   '2px',
        DEFAULT: '3px',
        md:   '4px',
        lg:   '6px',
        xl:   '10px',
        '2xl':'16px',
        full: '9999px',
      },
      letterSpacing: { eyebrow: '0.15em', tightest: '-0.02em' },
      boxShadow: {
        sheet: '0 1px 3px rgba(15,23,42,0.05), 0 10px 25px -5px rgba(15,23,42,0.05)',
        lift:  '0 4px 6px rgba(15,23,42,0.05), 0 20px 40px -10px rgba(15,23,42,0.1)',
        key:   '0 0 0 3px rgba(30,58,138,0.14)',
      },
      keyframes: {
        rise:     { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
        fanin:    { '0%': { opacity: 0, transform: 'translateY(16px) scale(0.96)' }, '100%': { opacity: 1, transform: 'none' } },
        pulse2:   { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
        track:    { '0%': { strokeDashoffset: 1300 }, '100%': { strokeDashoffset: 0 } },
        travel:   { to: { strokeDashoffset: -240 } },
        spinslow: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        rise:      'rise 0.28s cubic-bezier(0.2,0.8,0.2,1) both',
        fanin:     'fanin 0.5s cubic-bezier(0.2,0.9,0.2,1) both',
        pulse2:    'pulse2 1.5s ease-in-out infinite',
        track:     'track 3.4s ease-out both',
        travel:    'travel 1.5s linear infinite',
        spinslow:  'spinslow 44s linear infinite',
        spin:      'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
}
