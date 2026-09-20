import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // (no darkMode: the app ships zero dark: variants)
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        foreground: '#000000',
        muted: '#F8F8F8', // matches --color-surface / --muted in globals.css (single source of truth)
        'muted-foreground': '#525252',
        border: '#000000',
        'border-light': '#E5E5E5',
        card: '#FFFFFF',
        'card-foreground': '#000000',
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        serif: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        body: ['var(--font-source-serif)', 'Source Serif 4', 'Georgia', 'serif'],
        sans: ['var(--font-source-serif)', 'Source Serif 4', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        sm: '0px',
        DEFAULT: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      },
      fontSize: {
        '7xl': '5rem',
        '8xl': '6.5rem',
        '9xl': '8.5rem',
      },
      boxShadow: {
        'hard-sm': '3px 3px 0 #000000',
        hard: '6px 6px 0 #000000',
      },
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'icon-swap': 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        press: '120ms',
        hover: '150ms',
        pop: '200ms',
        modal: '220ms',
        drawer: '280ms',
      },
      // Documented z-scale (audit §2.6): chrome < toast < overlay < drawer < modal.
      zIndex: {
        chrome: '20',
        toast: '30',
        overlay: '40',
        drawer: '90',
        modal: '100',
      },
      letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
        widest: '0.1em', // Tailwind default; 0.15em strung out 9–10px mono labels
      },
    },
  },
  plugins: [],
};

export default config;
