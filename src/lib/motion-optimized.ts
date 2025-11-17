/**
 * Optimized Motion system with tree-shaking support
 * Provides only the essential features with minimal bundle impact
 */

// Core utilities - always included
export { getDuration, getEasing, getDelay, isMotionEnabled } from './motion'

// Import for internal use
import { getDuration, getEasing, getDelay, isMotionEnabled } from './motion'

// Lazy exports for tree-shaking
export const createOptimizedMotion = () => {
  return {
    // Core functions
    getDuration,
    getEasing,
    getDelay,
    isMotionEnabled,

    // Animation functions
    animate,
    batchAnimate,

    // Lazy-loaded features
    getVariants: () =>
      import('./motion-variants').then((m) => m.MOTION_VARIANTS),
    getOptimizedVariants: () =>
      import('./optimized-variants').then((m) => m.OPTIMIZED_VARIANTS),
    getPerformanceMonitor: () =>
      import('./performance-monitor').then((m) => m.usePerformanceMonitor),
    getLazyMotion: () => import('./lazy-motion').then((m) => m.useLazyMotion),
  }
}

// Minimal presets for essential animations
export const MINIMAL_PRESETS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },

  slideUp: {
    initial: { opacity: 0, transform: 'translateY(10px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-10px)' },
    transition: { duration: 0.2 },
  },

  scaleIn: {
    initial: { opacity: 0, transform: 'scale(0.95)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.95)' },
    transition: { duration: 0.2 },
  },
} as const

// Performance-optimized animation functions
export const animate = (
  element: HTMLElement,
  preset: keyof typeof MINIMAL_PRESETS
) => {
  if (!isMotionEnabled()) return Promise.resolve()

  const config = MINIMAL_PRESETS[preset]
  element.style.opacity = config.initial.opacity.toString()

  if (config.initial.transform) {
    element.style.transform = config.initial.transform
  }

  // Use Web Animations API for better performance
  const animation = element.animate([config.initial, config.animate], {
    duration: config.transition.duration * 1000,
    easing: 'ease-out',
    fill: 'forwards',
  })

  return animation.finished
}

// Batch animation utility
export const batchAnimate = (
  elements: HTMLElement[],
  preset: keyof typeof MINIMAL_PRESETS
) => {
  return Promise.all(elements.map((el) => animate(el, preset)))
}

// Export types for tree-shaking
export type MinimalPresetName = keyof typeof MINIMAL_PRESETS
