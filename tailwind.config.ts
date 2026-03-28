import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* Paleta piña tropical */
        primary: '#F4C542',
        'primary-light': '#f8d66a',
        'primary-dark': '#d4a82e',
        sand: '#E9D8A6',
        beige: '#F2E9D0',
        'leaf': '#5C8D3A',
        'leaf-soft': '#8FBF5A',
        brown: '#8C6239',
        'brown-soft': '#a67c52',
        'background-dark': '#f5f0e8',
        surface: '#faf7f2',
        /* Modo oscuro nativo (prefers-color-scheme: dark) */
        'dark-bg': '#0d0c09',
        'dark-surface': '#161410',
        'dark-card': '#1c1912',
        'dark-text': '#e9d8a6',
        'dark-muted': '#b8a574',
        'dark-border': 'rgba(244, 197, 66, 0.18)'
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px'
      },
      boxShadow: {
        glow: '0 0 60px rgba(244, 197, 66, 0.18)',
        'glow-warm': '0 0 48px rgba(244, 197, 66, 0.12)',
        panel: '0 2px 16px rgba(140, 98, 57, 0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        'panel-dark': '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(244,197,66,0.1), inset 0 1px 0 rgba(255,255,255,0.04)',
        marble: '0 4px 14px rgba(92, 141, 58, 0.2)',
        'marble-selected': '0 6px 20px rgba(244, 197, 66, 0.35)',
        'casino-card': '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(140,98,57,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
        'casino-card-dark': '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(244,197,66,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
        'casino-btn': '0 4px 14px rgba(244, 197, 66, 0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
        'casino-btn-dark': '0 4px 20px rgba(244, 197, 66, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')]
};

export default config;
