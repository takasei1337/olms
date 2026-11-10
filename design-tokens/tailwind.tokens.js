/**
 * OLMS Design System - Tailwind CSS Configuration Plugin / Theme Extension
 * Bridges 3-layer Design Tokens (tokens.json & tokens.css) to Tailwind CSS utilities.
 */

module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--olms-brand-50)',
          100: 'var(--olms-brand-100)',
          200: 'var(--olms-brand-200)',
          500: 'var(--olms-brand-500)',
          600: 'var(--olms-brand-600)',
          700: 'var(--olms-brand-700)',
          900: 'var(--olms-brand-900)',
          DEFAULT: 'var(--olms-brand-primary)',
        },
        surface: {
          canvas: 'var(--olms-surface-canvas)',
          card: 'var(--olms-surface-card)',
          overlay: 'var(--olms-surface-overlay)',
          muted: 'var(--olms-surface-muted)',
          border: 'var(--olms-surface-border)',
        },
        text: {
          primary: 'var(--olms-text-primary)',
          secondary: 'var(--olms-text-secondary)',
          tertiary: 'var(--olms-text-tertiary)',
          inverse: 'var(--olms-text-inverse)',
        },
        semantic: {
          success: 'var(--olms-semantic-success)',
          'success-bg': 'var(--olms-semantic-success-bg)',
          warning: 'var(--olms-semantic-warning)',
          'warning-bg': 'var(--olms-semantic-warning-bg)',
          error: 'var(--olms-semantic-error)',
          'error-bg': 'var(--olms-semantic-error-bg)',
          info: 'var(--olms-semantic-info)',
          'info-bg': 'var(--olms-semantic-info-bg)',
        },
        // OLMS Specific Domain Tokens
        exam: {
          saved: 'var(--olms-exam-status-saved)',
          saving: 'var(--olms-exam-status-saving)',
          unanswered: 'var(--olms-exam-status-unanswered)',
          flagged: 'var(--olms-exam-status-flagged)',
        },
        timer: {
          normal: 'var(--olms-timer-normal)',
          warning: 'var(--olms-timer-warning)',
          critical: 'var(--olms-timer-critical)',
        },
        ai: {
          similarity: 'var(--olms-ai-similarity-badge)',
          'similarity-bg': 'var(--olms-ai-similarity-badge-bg)',
          override: 'var(--olms-ai-override-notice)',
        },
        omr: {
          valid: 'var(--olms-omr-valid)',
          invalid: 'var(--olms-omr-invalid)',
          ambiguous: 'var(--olms-omr-ambiguous)',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--olms-radius-md)',
        sm: 'var(--olms-radius-sm)',
        md: 'var(--olms-radius-md)',
        lg: 'var(--olms-radius-lg)',
        xl: 'var(--olms-radius-xl)',
        full: 'var(--olms-radius-full)',
      },
      boxShadow: {
        sm: 'var(--olms-shadow-sm)',
        md: 'var(--olms-shadow-md)',
        lg: 'var(--olms-shadow-lg)',
        exam: 'var(--olms-shadow-exam-focus)',
      },
      fontFamily: {
        sans: 'var(--olms-font-sans)',
        mono: 'var(--olms-font-mono)',
        math: 'var(--olms-font-math)',
      },
      transitionDuration: {
        fast: 'var(--olms-transition-fast)',
        normal: 'var(--olms-transition-normal)',
      },
    },
  },
};
