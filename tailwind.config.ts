import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'rgb(var(--border-primary))',
        background: 'rgb(var(--bg-primary))',
        foreground: 'rgb(var(--text-primary))',
        muted: {
          DEFAULT: 'rgb(var(--bg-secondary))',
          foreground: 'rgb(var(--text-secondary))',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent))',
          foreground: 'rgb(var(--bg-primary))',
          hover: 'rgb(var(--accent-hover))',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Oxygen"',
          '"Ubuntu"',
          '"Cantarell"',
          '"Fira Sans"',
          '"Droid Sans"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      // Modern spacing and typography
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      // Modern utilities
      backdropBlur: {
        xs: '2px',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      // Container queries support
      screens: {
        xs: '475px',
      },
      // Modern aspect ratios
      aspectRatio: {
        '4/3': '4 / 3',
        '3/2': '3 / 2',
        '2/3': '2 / 3',
        '9/16': '9 / 16',
      },
    },
  },
  plugins: [
    // Custom plugin for scrollbar utilities
    ({ addUtilities }) => {
      addUtilities({
        '.scrollbar-thin': {
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgb(var(--bg-secondary))',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgb(var(--text-tertiary))',
            borderRadius: '9999px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgb(var(--text-secondary))',
          },
        },
        '.scrollbar-none': {
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.scrollbar-hover': {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
            opacity: '0',
            transition: 'opacity 0.2s',
          },
          '&:hover::-webkit-scrollbar': {
            opacity: '1',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgb(var(--bg-secondary))',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgb(var(--text-tertiary))',
            borderRadius: '9999px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgb(var(--text-secondary))',
          },
        },
      })
    },
    // Custom plugin for glass morphism
    ({ addUtilities }) => {
      addUtilities({
        '.glass': {
          'backdrop-filter': 'blur(10px)',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.dark .glass': {
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.glass-sm': {
          'backdrop-filter': 'blur(6px)',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.dark .glass-sm': {
          background: 'rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        },
        '.glass-md': {
          'backdrop-filter': 'blur(8px)',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        },
        '.dark .glass-md': {
          background: 'rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
      })
    },
    // Modern focus ring utilities
    ({ addUtilities }) => {
      addUtilities({
        '.focus-ring': {
          '&:focus': {
            outline: 'none',
            'box-shadow':
              '0 0 0 2px rgb(var(--accent)), 0 0 0 4px rgba(59, 130, 246, 0.1)',
          },
        },
        '.focus-ring-inset': {
          '&:focus': {
            outline: 'none',
            'box-shadow': 'inset 0 0 0 2px rgb(var(--accent))',
          },
        },
      })
    },
  ],
} satisfies Config
