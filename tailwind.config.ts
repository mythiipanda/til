import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        foreground: '#000000',
        muted: '#F5F5F5',
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
      letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
        widest: '0.15em',
      },
    },
  },
  plugins: [],
};

export default config;
