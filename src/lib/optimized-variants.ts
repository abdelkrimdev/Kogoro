/**
 * Performance-optimized motion variants
 * Focuses on GPU-accelerated properties and minimal layout thrashing
 */

import { getDuration, isMotionEnabled } from './motion'
import type {
  MotionPreset,
  AnimatableProperties,
  TransformProperties,
} from '../types/motion'

// ============================================================================
// PERFORMANCE-OPTIMIZED PRESETS
// ============================================================================

/**
 * GPU-accelerated fade animations (opacity only)
 */
export const optimizedFade = {
  instant: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0 },
  } as MotionPreset,

  fast: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  smooth: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: 'ease-in-out',
    },
  } as MotionPreset,
} as const

/**
 * Transform-only slide animations (GPU accelerated)
 */
export const optimizedSlide = {
  // Horizontal slides using translateX
  slideLeft: {
    initial: { opacity: 0, transform: 'translateX(20px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(-20px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  slideRight: {
    initial: { opacity: 0, transform: 'translateX(-20px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(20px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  // Vertical slides using translateY
  slideUp: {
    initial: { opacity: 0, transform: 'translateY(20px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-20px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  slideDown: {
    initial: { opacity: 0, transform: 'translateY(-20px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(20px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,
} as const

/**
 * Scale animations (GPU accelerated)
 */
export const optimizedScale = {
  scaleIn: {
    initial: { opacity: 0, transform: 'scale(0.95)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.95)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  scaleOut: {
    initial: { opacity: 1, transform: 'scale(1)' },
    animate: { opacity: 0, transform: 'scale(1.05)' },
    exit: { opacity: 0, transform: 'scale(1.05)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-in',
    },
  } as MotionPreset,

  // Subtle scale for hover effects
  hover: {
    initial: { transform: 'scale(1)' },
    hover: { transform: 'scale(1.02)' },
    transition: {
      duration: 150 / 1000, // 150ms for responsive feel
      easing: 'ease-out',
    },
  } as MotionPreset,
} as const

/**
 * Optimized button animations
 */
export const optimizedButton = {
  primary: {
    initial: { transform: 'scale(1)' },
    hover: { transform: 'scale(1.02)' },
    active: { transform: 'scale(0.98)' },
    disabled: { opacity: 0.5, transform: 'scale(1)' },
    transition: {
      duration: 150 / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  secondary: {
    initial: { transform: 'scale(1)' },
    hover: { transform: 'scale(1.01)' },
    active: { transform: 'scale(0.99)' },
    disabled: { opacity: 0.5 },
    transition: {
      duration: 150 / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  ghost: {
    initial: { backgroundColor: 'transparent' },
    hover: { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
    active: { backgroundColor: 'rgba(0, 0, 0, 0.1)' },
    disabled: { opacity: 0.5 },
    transition: {
      duration: 150 / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,
} as const

/**
 * Optimized card animations
 */
export const optimizedCard = {
  // Grid card with minimal transform
  grid: {
    initial: { opacity: 0, transform: 'translateY(10px) scale(0.98)' },
    animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
    exit: { opacity: 0, transform: 'translateY(-10px) scale(0.98)' },
    hover: {
      transform: 'translateY(-2px) scale(1.01)',
    },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  // List card with horizontal movement only
  list: {
    initial: { opacity: 0, transform: 'translateX(-10px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(10px)' },
    hover: {
      transform: 'translateX(2px)',
    },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  // Compact card for mobile
  compact: {
    initial: { opacity: 0, transform: 'scale(0.99)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.99)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,
} as const

/**
 * Optimized modal animations
 */
export const optimizedModal = {
  // Fast overlay fade
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  // Content with minimal scale and translate
  content: {
    initial: { opacity: 0, transform: 'scale(0.98) translateY(10px)' },
    animate: { opacity: 1, transform: 'scale(1) translateY(0)' },
    exit: { opacity: 0, transform: 'scale(0.98) translateY(10px)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,

  // Fullscreen with scale only
  fullscreen: {
    initial: { opacity: 0, transform: 'scale(1.02)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(1.02)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,
} as const

/**
 * Optimized list animations
 */
export const optimizedList = {
  // Staggered with minimal movement
  staggered: {
    initial: { opacity: 0, transform: 'translateY(8px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-8px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
      delay: 0.05, // 50ms stagger
    },
  } as MotionPreset,

  // Sequential with horizontal movement
  sequential: {
    initial: { opacity: 0, transform: 'translateX(-8px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(8px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: 'ease-out',
    },
  } as MotionPreset,
} as const

/**
 * Optimized loading animations
 */
export const optimizedLoading = {
  // Simple spinner using transform
  spinner: {
    initial: { transform: 'rotate(0deg)' },
    animate: { transform: 'rotate(360deg)' },
    transition: {
      duration: 1000 / 1000, // 1 second
      easing: 'linear',
      repeat: Infinity,
    },
  } as MotionPreset,

  // Pulse using opacity only
  pulse: {
    initial: { opacity: 1 },
    animate: { opacity: 0.6 },
    transition: {
      duration: 800 / 1000, // 800ms
      easing: 'ease-in-out',
      repeat: Infinity,
      reverse: true,
    },
  } as MotionPreset,

  // Dots with scale
  dots: {
    initial: { transform: 'scale(1)' },
    animate: { transform: 'scale(1.2)' },
    transition: {
      duration: 600 / 1000, // 600ms
      easing: 'ease-in-out',
      repeat: Infinity,
      reverse: true,
    },
  } as MotionPreset,
} as const

// ============================================================================
// RESPONSIVE OPTIMIZATIONS
// ============================================================================

/**
 * Device-specific optimizations
 */
export const responsiveOptimizations = {
  // Mobile-optimized (shorter durations, smaller movements)
  mobile: {
    duration: 0.2, // 200ms
    movement: 8, // 8px
    scale: 0.02, // 2%
  },

  // Tablet-optimized
  tablet: {
    duration: 0.25, // 250ms
    movement: 12, // 12px
    scale: 0.03, // 3%
  },

  // Desktop-optimized
  desktop: {
    duration: 0.3, // 300ms
    movement: 16, // 16px
    scale: 0.05, // 5%
  },
} as const

/**
 * Get device-specific optimization settings
 */
export function getDeviceOptimizations() {
  if (typeof window === 'undefined') {
    return responsiveOptimizations.desktop
  }

  const width = window.innerWidth
  if (width < 768) return responsiveOptimizations.mobile
  if (width < 1024) return responsiveOptimizations.tablet
  return responsiveOptimizations.desktop
}

/**
 * Create device-optimized variant
 */
export function createDeviceVariant(baseVariant: MotionPreset): MotionPreset {
  const device = getDeviceOptimizations()

  return {
    ...baseVariant,
    transition: {
      ...baseVariant.transition,
      duration: device.duration,
    },
    // Reduce movement amounts for mobile
    ...(typeof baseVariant.initial?.transform === 'string' && {
      initial: {
        ...baseVariant.initial,
        transform: baseVariant.initial.transform.replace(
          /\d+px/g,
          `${device.movement}px`
        ),
      },
    }),
  }
}

// ============================================================================
// REDUCED MOTION OPTIMIZATIONS
// ============================================================================

/**
 * Accessibility-friendly variants
 */
export const reducedMotionOptimizations = {
  // Opacity-only transitions
  opacity: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: 0.1, // 100ms
      easing: 'linear',
    },
  } as MotionPreset,

  // Instant for users who prefer no motion
  instant: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0 },
  } as MotionPreset,

  // Color transitions only
  color: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 },
    transition: {
      duration: 0.2,
      easing: 'linear',
    },
  } as MotionPreset,
} as const

/**
 * Get accessible variant based on user preferences
 */
export function getAccessibleVariant(
  normalVariant: MotionPreset,
  reducedVariant: MotionPreset = reducedMotionOptimizations.opacity
): MotionPreset {
  return isMotionEnabled() ? normalVariant : reducedVariant
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Check if animation will use GPU acceleration
 */
export function isGPUAccelerated(variant: MotionPreset): boolean {
  const checkProperties = (obj: Record<string, unknown>): boolean => {
    if (!obj || typeof obj !== 'object') return true

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'transform' || key === 'opacity' || key === 'filter') {
        continue // These are GPU accelerated
      }
      if (typeof value === 'object' && value !== null) {
        if (!checkProperties(value as Record<string, unknown>)) return false
      } else if (
        key !== 'transition' &&
        key !== 'duration' &&
        key !== 'easing'
      ) {
        return false // Non-GPU property found
      }
    }
    return true
  }

  return checkProperties(variant as Record<string, unknown>)
}

/**
 * Optimize variant for performance
 */
export function optimizeVariant(variant: MotionPreset): MotionPreset {
  const optimized = { ...variant }

  // Ensure transitions use GPU-accelerated properties only
  if (variant.transition) {
    optimized.transition = {
      ...variant.transition,
      // Use faster easing functions
      easing:
        variant.transition.easing === 'ease-in-out'
          ? 'ease-out'
          : variant.transition.easing,
      // Cap duration at 300ms for responsiveness
      duration: Math.min(variant.transition.duration || 0.3, 0.3),
    }
  }

  return optimized
}

/**
 * Batch multiple animations for better performance
 */
export function batchAnimations(variants: MotionPreset[]): MotionPreset {
  const baseTransition = {
    duration: 0.2,
    easing: 'ease-out' as const,
  }

  return {
    initial: variants.reduce(
      (acc, variant) => ({ ...acc, ...(variant.initial || {}) }),
      {} as Partial<AnimatableProperties & TransformProperties>
    ),
    animate: variants.reduce(
      (acc, variant) => ({ ...acc, ...(variant.animate || {}) }),
      {} as Partial<AnimatableProperties & TransformProperties>
    ),
    exit: variants.reduce(
      (acc, variant) => ({ ...acc, ...(variant.exit || {}) }),
      {} as Partial<AnimatableProperties & TransformProperties>
    ),
    transition: baseTransition,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const OPTIMIZED_VARIANTS = {
  fade: optimizedFade,
  slide: optimizedSlide,
  scale: optimizedScale,
  button: optimizedButton,
  card: optimizedCard,
  modal: optimizedModal,
  list: optimizedList,
  loading: optimizedLoading,
  reducedMotion: reducedMotionOptimizations,
} as const
