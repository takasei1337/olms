/**
 * OLMS Design System - Tailwind CSS Configuration Plugin / Theme Extension
 * Bridges 3-layer Design Tokens (tokens.json & tokens.css) to Tailwind CSS utilities.
 */

module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--color-brand-50)',
          100: 'var(--color-brand-100)',
          200: 'var(--color-brand-200)',
          500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)',
          700: 'var(--color-brand-700)',
          900: 'var(--color-brand-900)',
          DEFAULT: 'var(--color-brand-600)',
        },
        surface: {
          canvas: 'var(--color-surface-canvas)',
          card: 'var(--color-surface-card)',
          overlay: 'var(--color-surface-overlay)',
          muted: 'var(--color-surface-muted)',
          border: 'var(--color-surface-border)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          inverse: 'var(--color-text-inverse)',
        },
        semantic: {
          success: 'var(--color-success)',
          'success-bg': 'var(--color-success-bg)',
          warning: 'var(--color-warning)',
          'warning-bg': 'var(--color-warning-bg)',
          error: 'var(--color-error)',
          'error-bg': 'var(--color-error-bg)',
          info: 'var(--color-info)',
          'info-bg': 'var(--color-info-bg)',
        },
        // OLMS Specific Domain Tokens
        exam: {
          saved: 'var(--color-exam-status-saved)',
          saving: 'var(--color-exam-status-saving)',
          unanswered: 'var(--color-exam-status-unanswered)',
          flagged: 'var(--color-exam-status-flagged)',
        },
        timer: {
          normal: 'var(--color-timer-normal)',
          warning: 'var(--color-timer-warning)',
          critical: 'var(--color-timer-critical)',
        },
        ai: {
          similarity: 'var(--color-ai-similarity-badge)',
          'similarity-bg': 'var(--color-ai-similarity-badge-bg)',
          override: 'var(--color-ai-override-notice)',
        },
        omr: {
          valid: 'var(--color-omr-bubble-valid)',
          invalid: 'var(--color-omr-bubble-invalid)',
          ambiguous: 'var(--color-omr-bubble-ambiguous)',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        exam: 'var(--shadow-exam-focus)',
      },
      fontFamily: {
        sans: 'var(--font-family-sans)',
        mono: 'var(--font-family-mono)',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        normal: 'var(--transition-normal)',
      },
    },
  },
};
