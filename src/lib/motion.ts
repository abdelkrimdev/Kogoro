/**
 * Motion configuration for Kogoro app
 * Integrates with the existing theme system and respects user preferences
 * Optimized for tree-shaking and minimal bundle impact
 */

import { createSignal, onCleanup } from 'solid-js'
import { UI_CONFIG } from './config'

/**
 * Animation duration presets
 */
export const MOTION_DURATIONS = {
  fast: UI_CONFIG.animationDuration.fast,
  normal: UI_CONFIG.animationDuration.normal,
  slow: UI_CONFIG.animationDuration.slow,
  instant: 0,
} as const

/**
 * Animation easing functions
 */
export const MOTION_EASING = {
  ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.58, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  linear: 'linear',
} as const

/**
 * Animation delay presets
 */
export const MOTION_DELAYS = {
  none: 0,
  short: 50,
  normal: 100,
  long: 200,
} as const

/**
 * Motion configuration state
 */
interface MotionState {
  reducedMotion: boolean
  enabled: boolean
}

const [motionState, setMotionState] = createSignal<MotionState>({
  reducedMotion: false,
  enabled: true,
})

// Inline implementation to avoid circular dependency
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function watchReducedMotion(
  callback: (prefersReduced: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  const handleChange = () => {
    callback(mediaQuery.matches)
  }

  mediaQuery.addEventListener('change', handleChange)

  // Return cleanup function
  return () => {
    mediaQuery.removeEventListener('change', handleChange)
  }
}

/**
 * Initialize motion system and watch for reduced motion changes
 */
export function initializeMotion(): void {
  if (typeof window === 'undefined') return

  // Set initial reduced motion state
  setMotionState({
    reducedMotion: prefersReducedMotion(),
    enabled: true,
  })

  // Watch for reduced motion preference changes
  const cleanup = watchReducedMotion((prefersReduced) => {
    setMotionState((prev) => ({
      ...prev,
      reducedMotion: prefersReduced,
    }))
  })

  onCleanup(cleanup)
}

/**
 * Get current motion state
 */
export function getMotionState(): MotionState {
  return motionState()
}

/**
 * Check if animations are enabled
 */
export function isMotionEnabled(): boolean {
  const state = getMotionState()
  return state.enabled && !state.reducedMotion
}

/**
 * Get animation duration respecting reduced motion preferences
 */
export function getDuration(duration: keyof typeof MOTION_DURATIONS): number {
  return isMotionEnabled() ? MOTION_DURATIONS[duration] : 0
}

/**
 * Get animation easing function
 */
export function getEasing(easing: keyof typeof MOTION_EASING): string {
  return MOTION_EASING[easing]
}

/**
 * Get animation delay respecting reduced motion preferences
 */
export function getDelay(delay: keyof typeof MOTION_DELAYS): number {
  return isMotionEnabled() ? MOTION_DELAYS[delay] : 0
}

/**
 * Animation presets for common UI patterns
 */
export const MOTION_PRESETS = {
  // Fade animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: getDuration('normal') / 1000 },
  },

  fadeOut: {
    initial: { opacity: 1 },
    animate: { opacity: 0 },
    exit: { opacity: 0 },
    transition: { duration: getDuration('normal') / 1000 },
  },

  // Slide animations
  slideInRight: {
    initial: { opacity: 0, transform: 'translateX(100%)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(-100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  },

  slideInLeft: {
    initial: { opacity: 0, transform: 'translateX(-100%)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  },

  slideInUp: {
    initial: { opacity: 0, transform: 'translateY(100%)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  },

  slideInDown: {
    initial: { opacity: 0, transform: 'translateY(-100%)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  },

  // Scale animations
  scaleIn: {
    initial: { opacity: 0, transform: 'scale(0.9)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.9)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  },

  scaleOut: {
    initial: { opacity: 1, transform: 'scale(1)' },
    animate: { opacity: 0, transform: 'scale(0.9)' },
    exit: { opacity: 0, transform: 'scale(0.9)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeIn'),
    },
  },

  // Bounce animations
  bounceIn: {
    initial: { opacity: 0, transform: 'scale(0.3)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.3)' },
    transition: {
      duration: getDuration('slow') / 1000,
      easing: getEasing('bounce'),
    },
  },

  // Theme-aware transitions
  themeTransition: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  },

  // List item animations
  listItem: {
    initial: { opacity: 0, transform: 'translateY(20px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-20px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
      delay: getDelay('short') / 1000,
    },
  },

  // Grid item animations
  gridItem: {
    initial: { opacity: 0, transform: 'scale(0.8)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.8)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  },

  // Modal animations
  modalOverlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  },

  modalContent: {
    initial: { opacity: 0, transform: 'scale(0.9) translateY(20px)' },
    animate: { opacity: 1, transform: 'scale(1) translateY(0)' },
    exit: { opacity: 0, transform: 'scale(0.9) translateY(20px)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  },

  // Sidebar animations
  sidebar: {
    initial: { transform: 'translateX(-100%)' },
    animate: { transform: 'translateX(0)' },
    exit: { transform: 'translateX(-100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  },

  // Loading animations
  pulse: {
    initial: { opacity: 1 },
    animate: { opacity: 0.5 },
    transition: {
      duration: getDuration('slow') / 1000,
      easing: getEasing('easeInOut'),
      repeat: Infinity,
      reverse: true,
    },
  },

  spin: {
    initial: { transform: 'rotate(0deg)' },
    animate: { transform: 'rotate(360deg)' },
    transition: {
      duration: getDuration('slow') / 1000,
      easing: getEasing('easeInOut'),
      repeat: Infinity,
    },
  },
} as const

/**
 * Theme-aware animation variants
 */
export const THEME_MOTION_VARIANTS = {
  // Light theme specific animations
  light: {
    subtle: {
      initial: { opacity: 0.8 },
      animate: { opacity: 1 },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeInOut'),
      },
    },
    vibrant: {
      initial: { opacity: 0, filter: 'brightness(0.8)' },
      animate: { opacity: 1, filter: 'brightness(1)' },
      transition: {
        duration: getDuration('fast') / 1000,
        easing: getEasing('easeOut'),
      },
    },
  },

  // Dark theme specific animations
  dark: {
    subtle: {
      initial: { opacity: 0.7 },
      animate: { opacity: 1 },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeInOut'),
      },
    },
    vibrant: {
      initial: { opacity: 0, filter: 'brightness(1.2)' },
      animate: { opacity: 1, filter: 'brightness(1)' },
      transition: {
        duration: getDuration('fast') / 1000,
        easing: getEasing('easeOut'),
      },
    },
  },
} as const

/**
 * Utility function to create custom animation presets
 */
export function createMotionPreset(
  preset: Partial<typeof MOTION_PRESETS.fadeIn>
): typeof MOTION_PRESETS.fadeIn {
  const basePreset = MOTION_PRESETS.fadeIn
  return {
    ...basePreset,
    ...preset,
    transition: {
      ...basePreset.transition,
      ...preset.transition,
    },
  }
}

/**
 * Utility function to get theme-aware animation
 */
export function getThemeMotion(
  theme: 'light' | 'dark',
  variant: keyof typeof THEME_MOTION_VARIANTS.light
) {
  return THEME_MOTION_VARIANTS[theme][variant]
}

/**
 * CSS-in-JS animation utilities for Tailwind integration
 */
export const MOTION_CSS = {
  // Generate CSS transition string
  transition: (
    properties: string[],
    duration: keyof typeof MOTION_DURATIONS = 'normal',
    easing: keyof typeof MOTION_EASING = 'easeInOut'
  ): string => {
    const durationMs = getDuration(duration)
    const easingFn = getEasing(easing)
    return properties
      .map((prop) => `${prop} ${durationMs}ms ${easingFn}`)
      .join(', ')
  },

  // Generate CSS animation string
  animation: (
    name: string,
    duration: keyof typeof MOTION_DURATIONS = 'normal',
    easing: keyof typeof MOTION_EASING = 'easeInOut',
    delay: keyof typeof MOTION_DELAYS = 'none',
    count: number | 'infinite' = 1,
    direction: 'normal' | 'reverse' | 'alternate' = 'normal'
  ): string => {
    const durationMs = getDuration(duration)
    const easingFn = getEasing(easing)
    const delayMs = getDelay(delay)
    return `${name} ${durationMs}ms ${easingFn} ${delayMs}ms ${count} ${direction}`
  },

  // Generate CSS keyframes
  keyframes: (
    frames: Record<string, Record<string, string | number>>
  ): string => {
    const keyframeRules = Object.entries(frames)
      .map(([offset, properties]) => {
        const props = Object.entries(properties)
          .map(([prop, value]) => `${prop}: ${value}`)
          .join('; ')
        return `${offset} { ${props} }`
      })
      .join(' ')
    return `@keyframes animation { ${keyframeRules} }`
  },
} as const

/**
 * Common animation keyframes
 */
export const MOTION_KEYFRAMES = {
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  fadeOut: {
    '0%': { opacity: '1' },
    '100%': { opacity: '0' },
  },
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
  scaleIn: {
    '0%': { opacity: '0', transform: 'scale(0.9)' },
    '100%': { opacity: '1', transform: 'scale(1)' },
  },
  bounce: {
    '0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0, 0, 0)' },
    '40%, 43%': { transform: 'translate3d(0, -30px, 0)' },
    '70%': { transform: 'translate3d(0, -15px, 0)' },
    '90%': { transform: 'translate3d(0, -4px, 0)' },
  },
  pulse: {
    '0%': { opacity: '1' },
    '50%': { opacity: '0.5' },
    '100%': { opacity: '1' },
  },
  spin: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
} as const

/**
 * Hook for using motion in components
 */
export function createMotion() {
  return {
    state: getMotionState,
    isEnabled: isMotionEnabled,
    getDuration,
    getEasing,
    getDelay,
    presets: MOTION_PRESETS,
    variants: THEME_MOTION_VARIANTS,
    css: MOTION_CSS,
    keyframes: MOTION_KEYFRAMES,
  }
}

/**
 * Types for TypeScript integration
 */
export type MotionPresetName = keyof typeof MOTION_PRESETS
export type MotionDuration = keyof typeof MOTION_DURATIONS
export type MotionEasing = keyof typeof MOTION_EASING
export type MotionDelay = keyof typeof MOTION_DELAYS
export type ThemeMotionVariantName = keyof typeof THEME_MOTION_VARIANTS.light

// Re-export proper types from types/motion.ts
export type {
  MotionPreset,
  AnimationVariant,
  AnimationTransition,
  ThemeMotionVariant,
} from '../types/motion'

/**
 * Re-export commonly used utilities
 */
export { watchReducedMotion }

// Tree-shaking friendly exports
export const createMinimalMotion = () => {
  return {
    // Core functions
    getDuration,
    getEasing,
    getDelay,
    isMotionEnabled,

    // Essential presets only
    presets: {
      fadeIn: MOTION_PRESETS.fadeIn,
      slideInUp: MOTION_PRESETS.slideInUp,
      scaleIn: MOTION_PRESETS.scaleIn,
    },

    // CSS utilities
    css: {
      transition: MOTION_CSS.transition,
      animation: MOTION_CSS.animation,
    },
  }
}
