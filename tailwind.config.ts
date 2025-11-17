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
        tertiary: {
          DEFAULT: 'rgb(var(--bg-tertiary))',
          foreground: 'rgb(var(--text-tertiary))',
          border: 'rgb(var(--border-tertiary))',
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
      // Motion-specific animation keyframes
      keyframes: {
        // Fade animations
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        fadeScale: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        crossfade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },

        // Slide animations
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInDown: {
          '0%': { opacity: '0', transform: 'translateY(-100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideFade: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },

        // Scale animations
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1.1)' },
        },
        bounceScale: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },

        // Bounce animations
        bounce: {
          '0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '40%, 43%': { transform: 'translate3d(0, -30px, 0)' },
          '70%': { transform: 'translate3d(0, -15px, 0)' },
          '90%': { transform: 'translate3d(0, -4px, 0)' },
        },

        // Loading animations
        pulse: {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        dots: {
          '0%, 80%, 100%': { transform: 'scale(0.8)', opacity: '0.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        skeleton: {
          '0%': { opacity: '0.5' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.5' },
        },

        // Theme-aware animations
        themeTransition: {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.8' },
          '100%': { opacity: '1' },
        },

        // Collection-specific animations
        cardHover: {
          '0%': { transform: 'translateY(0px) scale(1)' },
          '100%': { transform: 'translateY(-4px) scale(1.02)' },
        },
        listSlide: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        searchFocus: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.02)' },
        },
      },

      // Motion-specific animation utilities
      animation: {
        // Fade animations
        'fade-in': 'fadeIn 150ms ease-out',
        'fade-out': 'fadeOut 150ms ease-out',
        'fade-scale': 'fadeScale 300ms ease-out',
        'crossfade': 'crossfade 150ms ease-in-out',

        // Slide animations
        'slide-right': 'slideInRight 300ms ease-out',
        'slide-left': 'slideInLeft 300ms ease-out',
        'slide-up': 'slideInUp 300ms ease-out',
        'slide-down': 'slideInDown 300ms ease-out',
        'slide-fade': 'slideFade 300ms ease-in-out',

        // Scale animations
        'scale-in': 'scaleIn 150ms ease-out',
        'scale-out': 'scaleOut 150ms ease-in',
        'bounce-scale': 'bounceScale 500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',

        // Bounce animations
        'bounce': 'bounce 1000ms ease-in-out',
        'bounce-gentle': 'bounce 600ms ease-in-out',

        // Loading animations
        'pulse': 'pulse 500ms ease-in-out infinite',
        'pulse-slow': 'pulse 1000ms ease-in-out infinite',
        'spin': 'spin 500ms linear infinite',
        'spin-slow': 'spin 2000ms linear infinite',
        'dots': 'dots 1400ms ease-in-out infinite',
        'skeleton': 'skeleton 1000ms ease-in-out infinite',

        // Theme animations
        'theme-transition': 'themeTransition 300ms ease-in-out',

        // Collection-specific animations
        'card-hover': 'cardHover 150ms ease-out',
        'list-slide': 'listSlide 150ms ease-out',
        'search-focus': 'searchFocus 150ms ease-out',

        // Staggered animations
        'stagger-fast': 'fadeIn 150ms ease-out',
        'stagger-normal': 'fadeIn 300ms ease-out',
        'stagger-slow': 'fadeIn 500ms ease-out',
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

      // Motion-specific duration utilities (matching motion.ts)
      transitionDuration: {
        '0': '0ms',
        '50': '50ms',
        '100': '100ms',
        '150': '150ms', // fast
        '200': '200ms',
        '300': '300ms', // normal
        '400': '400ms',
        '500': '500ms', // slow
        '600': '600ms',
        'theme': '300ms',
        'motion-fast': '150ms',
        'motion-normal': '300ms',
        'motion-slow': '500ms',
      },

      // Motion-specific easing utilities (matching motion.ts)
      transitionTimingFunction: {
        'motion-ease': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'motion-ease-in': 'cubic-bezier(0.42, 0, 1, 1)',
        'motion-ease-out': 'cubic-bezier(0, 0, 0.58, 1)',
        'motion-ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'motion-bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'motion-linear': 'linear',
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        theme: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // Motion-specific delay utilities
      transitionDelay: {
        '0': '0ms',
        '50': '50ms',
        '100': '100ms',
        '200': '200ms',
        'motion-short': '50ms',
        'motion-normal': '100ms',
        'motion-long': '200ms',
      },

      // Transform utilities for motion animations
      scale: {
        '0': '0',
        '50': '0.5',
        '75': '0.75',
        '80': '0.8',
        '90': '0.9',
        '95': '0.95',
        '98': '0.98',
        '99': '0.99',
        '101': '1.01',
        '102': '1.02',
        '105': '1.05',
        '110': '1.1',
        '125': '1.25',
      },

      // Translate utilities for motion animations
      translate: {
        '4': '1rem',
        '8': '2rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '28': '7rem',
        '32': '8rem',
        '36': '9rem',
        '40': '10rem',
        '44': '11rem',
        '48': '12rem',
        '52': '13rem',
        '56': '14rem',
        '60': '15rem',
        '64': '16rem',
        '72': '18rem',
        '80': '20rem',
        '96': '24rem',
      },

      // Rotate utilities for motion animations
      rotate: {
        '1': '1deg',
        '2': '2deg',
        '3': '3deg',
        '5': '5deg',
        '6': '6deg',
        '12': '12deg',
        '45': '45deg',
        '90': '90deg',
        '180': '180deg',
        '270': '270deg',
      },

      // Filter utilities for motion animations
      brightness: {
        '80': '0.8',
        '90': '0.9',
        '95': '0.95',
        '100': '1',
        '105': '1.05',
        '110': '1.1',
        '120': '1.2',
      },

      // Z-index utilities for layered animations
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
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
    // Theme transition utilities
    ({ addUtilities }) => {
      addUtilities({
        '.theme-transition': {
          transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        '.theme-transition-bg': {
          transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        '.theme-transition-text': {
          transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        '.theme-transition-border': {
          transition: 'border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        '.theme-transition-all': {
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        // Respect reduced motion
        '@media (prefers-reduced-motion: reduce)': {
          '.theme-transition': {
            transition: 'none',
          },
          '.theme-transition-bg': {
            transition: 'none',
          },
          '.theme-transition-text': {
            transition: 'none',
          },
          '.theme-transition-border': {
            transition: 'none',
          },
          '.theme-transition-all': {
            transition: 'none',
          },
        },
      })
    },
  ],
} satisfies Config
