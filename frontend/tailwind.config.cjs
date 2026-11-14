const olmsTokens = require('../design-tokens/tailwind.tokens.js');
const tailwindcssAnimate = require('tailwindcss-animate');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      ...olmsTokens.theme.extend,
      colors: {
        ...olmsTokens.theme.extend.colors,
        border: 'var(--olms-surface-border)',
        input: 'var(--olms-surface-border)',
        ring: 'var(--olms-brand-600)',
        background: 'var(--olms-surface-canvas)',
        foreground: 'var(--olms-text-primary)',
        primary: {
          DEFAULT: 'var(--olms-brand-600)',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'var(--olms-surface-muted)',
          foreground: 'var(--olms-text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--olms-semantic-error)',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'var(--olms-surface-muted)',
          foreground: 'var(--olms-text-secondary)',
        },
        accent: {
          DEFAULT: 'var(--olms-semantic-info-bg)',
          foreground: 'var(--olms-text-primary)',
        },
        popover: {
          DEFAULT: 'var(--olms-surface-card)',
          foreground: 'var(--olms-text-primary)',
        },
        card: {
          DEFAULT: 'var(--olms-surface-card)',
          foreground: 'var(--olms-text-primary)',
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
