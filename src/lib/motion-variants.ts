/**
 * Comprehensive animation variants library for Kogoro app
 * Provides reusable animation presets for UI components, layouts, and interactions
 */

import type {
  MotionPreset,
  ThemeMotionVariant,
  AnimationTransition,
  TransformProperties,
  AnimatableProperties,
} from '../types/motion'

import { getDuration, getEasing, getDelay, isMotionEnabled } from './motion'

import { THEME_COLORS, SEMANTIC_COLORS } from './theme-constants'

// ============================================================================
// ENTRY/EXIT ANIMATIONS
// ============================================================================

/**
 * Fade animations for elements appearing and disappearing
 */
export const fadeVariants = {
  /** Simple fade in from transparent to opaque */
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Fade in with slight scale effect */
  fadeInScale: {
    initial: { opacity: 0, transform: 'scale(0.95)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.95)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Fade out with scale down */
  fadeOutScale: {
    initial: { opacity: 1, transform: 'scale(1)' },
    animate: { opacity: 0, transform: 'scale(0.95)' },
    exit: { opacity: 0, transform: 'scale(0.95)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeIn'),
    },
  } as MotionPreset,

  /** Crossfade between content */
  crossfade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

/**
 * Slide animations for directional entry/exit
 */
export const slideVariants = {
  /** Slide in from right */
  slideInRight: {
    initial: { opacity: 0, transform: 'translateX(100%)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(-100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Slide in from left */
  slideInLeft: {
    initial: { opacity: 0, transform: 'translateX(-100%)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Slide in from top */
  slideInDown: {
    initial: { opacity: 0, transform: 'translateY(-100%)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Slide in from bottom */
  slideInUp: {
    initial: { opacity: 0, transform: 'translateY(100%)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Slide with fade for smoother transitions */
  slideFade: {
    initial: { opacity: 0, transform: 'translateX(20px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(-20px)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

/**
 * Scale animations for growing/shrinking effects
 */
export const scaleVariants = {
  /** Scale in from small */
  scaleIn: {
    initial: { opacity: 0, transform: 'scale(0.8)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.8)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Scale out to large */
  scaleOut: {
    initial: { opacity: 1, transform: 'scale(1)' },
    animate: { opacity: 0, transform: 'scale(1.1)' },
    exit: { opacity: 0, transform: 'scale(1.1)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeIn'),
    },
  } as MotionPreset,

  /** Bouncy scale effect */
  bounceScale: {
    initial: { opacity: 0, transform: 'scale(0.3)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.3)' },
    transition: {
      duration: getDuration('slow') / 1000,
      easing: getEasing('bounce'),
    },
  } as MotionPreset,

  /** Gentle scale for hover effects */
  gentleScale: {
    initial: { transform: 'scale(1)' },
    animate: { transform: 'scale(1.02)' },
    exit: { transform: 'scale(1)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

// ============================================================================
// UI COMPONENT VARIANTS
// ============================================================================

/**
 * Button animations for interactive states
 */
export const buttonVariants = {
  /** Primary button with press effect */
  primary: {
    initial: { transform: 'scale(1)' },
    hover: {
      transform: 'scale(1.02)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
    active: { transform: 'scale(0.98)' },
    disabled: { opacity: 0.5, transform: 'scale(1)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Secondary button with subtle effects */
  secondary: {
    initial: { transform: 'scale(1)' },
    hover: {
      transform: 'scale(1.01)',
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    active: { transform: 'scale(0.99)' },
    disabled: { opacity: 0.5 },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Ghost button with background fill */
  ghost: {
    initial: { backgroundColor: 'transparent' },
    hover: { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
    active: { backgroundColor: 'rgba(0, 0, 0, 0.1)' },
    disabled: { opacity: 0.5 },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

/**
 * Card animations for collection items
 */
export const cardVariants = {
  /** Standard card with hover lift */
  standard: {
    initial: { opacity: 0, transform: 'translateY(20px) scale(0.95)' },
    animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
    exit: { opacity: 0, transform: 'translateY(-20px) scale(0.95)' },
    hover: {
      transform: 'translateY(-4px) scale(1.02)',
      boxShadow: '0 12px 24px rgba(0, 0, 0, 0.15)',
    },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Compact card for list views */
  compact: {
    initial: { opacity: 0, transform: 'translateX(-20px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(20px)' },
    hover: {
      transform: 'translateX(4px)',
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
    },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Featured card with dramatic effects */
  featured: {
    initial: { opacity: 0, transform: 'scale(0.8) rotateY(10deg)' },
    animate: { opacity: 1, transform: 'scale(1) rotateY(0deg)' },
    exit: { opacity: 0, transform: 'scale(0.8) rotateY(-10deg)' },
    hover: {
      transform: 'scale(1.05) rotateY(5deg)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    },
    transition: {
      duration: getDuration('slow') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,
} as const

/**
 * Modal animations for dialogs and overlays
 */
export const modalVariants = {
  /** Modal overlay fade */
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Modal content slide and scale */
  content: {
    initial: { opacity: 0, transform: 'scale(0.9) translateY(20px)' },
    animate: { opacity: 1, transform: 'scale(1) translateY(0)' },
    exit: { opacity: 0, transform: 'scale(0.9) translateY(20px)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Fullscreen modal */
  fullscreen: {
    initial: { opacity: 0, transform: 'scale(1.1)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(1.1)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Slide-up modal from bottom */
  slideUp: {
    initial: { opacity: 0, transform: 'translateY(100%)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,
} as const

/**
 * Sidebar animations for navigation
 */
export const sidebarVariants = {
  /** Slide-in sidebar from left */
  left: {
    initial: { transform: 'translateX(-100%)' },
    animate: { transform: 'translateX(0)' },
    exit: { transform: 'translateX(-100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Slide-in sidebar from right */
  right: {
    initial: { transform: 'translateX(100%)' },
    animate: { transform: 'translateX(0)' },
    exit: { transform: 'translateX(100%)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Compressed sidebar */
  compressed: {
    initial: { width: '280px' },
    animate: { width: '60px' },
    exit: { width: '280px' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

/**
 * List animations for dynamic content
 */
export const listVariants = {
  /** Staggered list item appearance */
  staggered: {
    initial: { opacity: 0, transform: 'translateY(20px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-20px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
      delay: getDelay('short') / 1000,
    },
  } as MotionPreset,

  /** Sequential list appearance */
  sequential: {
    initial: { opacity: 0, transform: 'translateX(-20px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(20px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Reorder animation for drag and drop */
  reorder: {
    initial: { transform: 'scale(1)' },
    animate: { transform: 'scale(1.05)' },
    exit: { transform: 'scale(0.95)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

// ============================================================================
// LAYOUT ANIMATIONS
// ============================================================================

/**
 * Page transition animations
 */
export const pageVariants = {
  /** Fade between pages */
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Slide pages horizontally */
  slide: {
    initial: { opacity: 0, transform: 'translateX(100px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(-100px)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Scale page transition */
  scale: {
    initial: { opacity: 0, transform: 'scale(0.95)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(1.05)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

/**
 * Container animations for layout changes
 */
export const containerVariants = {
  /** Smooth height transition */
  height: {
    initial: { height: 'auto' },
    animate: { height: 'auto' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Grid layout reorganization */
  gridReflow: {
    initial: { transform: 'scale(1)' },
    animate: { transform: 'scale(1)' },
    transition: {
      duration: getDuration('slow') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Flex layout changes */
  flexReflow: {
    initial: { flexGrow: 1 },
    animate: { flexGrow: 1 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

// ============================================================================
// INTERACTION VARIANTS
// ============================================================================

/**
 * Hover state animations
 */
export const hoverVariants = {
  /** Lift effect on hover */
  lift: {
    initial: { transform: 'translateY(0)' },
    hover: { transform: 'translateY(-4px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Glow effect on hover */
  glow: {
    initial: { boxShadow: 'none' },
    hover: {
      boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
    },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Brightness change on hover */
  brightness: {
    initial: { filter: 'brightness(1)' },
    hover: { filter: 'brightness(1.1)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Rotate slightly on hover */
  rotate: {
    initial: { transform: 'rotate(0deg)' },
    hover: { transform: 'rotate(2deg)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,
} as const

/**
 * Focus state animations
 */
export const focusVariants = {
  /** Scale on focus */
  scale: {
    initial: { transform: 'scale(1)' },
    focus: { transform: 'scale(1.02)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Border color animation on focus */
  border: {
    initial: { borderColor: 'transparent' },
    focus: { borderColor: THEME_COLORS.accent },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Shadow on focus */
  shadow: {
    initial: { boxShadow: 'none' },
    focus: {
      boxShadow: `0 0 0 3px ${THEME_COLORS.accent}33`,
    },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,
} as const

/**
 * Tap/Click state animations
 */
export const tapVariants = {
  /** Press down effect */
  press: {
    initial: { transform: 'scale(1)' },
    active: { transform: 'scale(0.95)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeIn'),
    },
  } as MotionPreset,

  /** Ripple effect */
  ripple: {
    initial: { transform: 'scale(0)', opacity: 1 },
    active: { transform: 'scale(1)', opacity: 0 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,
} as const

// ============================================================================
// LOADING VARIANTS
// ============================================================================

/**
 * Loading spinner animations
 */
export const loadingVariants = {
  /** Rotating spinner */
  spinner: {
    initial: { transform: 'rotate(0deg)' },
    animate: { transform: 'rotate(360deg)' },
    transition: {
      duration: getDuration('slow') / 1000,
      easing: getEasing('linear'),
      repeat: Infinity,
    },
  } as MotionPreset,

  /** Pulsing dots */
  dots: {
    initial: { opacity: 0.3 },
    animate: { opacity: 1 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
      repeat: Infinity,
      reverse: true,
    },
  } as MotionPreset,

  /** Skeleton loader */
  skeleton: {
    initial: { opacity: 0.5 },
    animate: { opacity: 1 },
    transition: {
      duration: getDuration('slow') / 1000,
      easing: getEasing('easeInOut'),
      repeat: Infinity,
      reverse: true,
    },
  } as MotionPreset,

  /** Progress bar */
  progress: {
    initial: { width: '0%' },
    animate: { width: '100%' },
    transition: {
      duration: getDuration('slow') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Bouncing dots */
  bounce: {
    initial: { transform: 'translateY(0)' },
    animate: { transform: 'translateY(-10px)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('bounce'),
      repeat: Infinity,
      reverse: true,
    },
  } as MotionPreset,
} as const

// ============================================================================
// THEME-AWARE VARIANTS
// ============================================================================

/**
 * Theme-aware animations that adapt to light/dark modes
 */
export const themeVariants = {
  /** Subtle theme transition */
  subtle: {
    light: {
      initial: { opacity: 0.9, filter: 'brightness(1)' },
      animate: { opacity: 1, filter: 'brightness(1)' },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeInOut'),
      },
    },
    dark: {
      initial: { opacity: 0.8, filter: 'brightness(1.1)' },
      animate: { opacity: 1, filter: 'brightness(1)' },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeInOut'),
      },
    },
  } as ThemeMotionVariant,

  /** Vibrant theme transition */
  vibrant: {
    light: {
      initial: { opacity: 0, filter: 'brightness(0.8)' },
      animate: { opacity: 1, filter: 'brightness(1)' },
      transition: {
        duration: getDuration('fast') / 1000,
        easing: getEasing('easeOut'),
      },
    },
    dark: {
      initial: { opacity: 0, filter: 'brightness(1.2)' },
      animate: { opacity: 1, filter: 'brightness(1)' },
      transition: {
        duration: getDuration('fast') / 1000,
        easing: getEasing('easeOut'),
      },
    },
  } as ThemeMotionVariant,

  /** Color-aware theme transition */
  colorAware: {
    light: {
      initial: {
        opacity: 0,
        backgroundColor: SEMANTIC_COLORS.info.bg,
        borderColor: SEMANTIC_COLORS.info.border,
      },
      animate: {
        opacity: 1,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeInOut'),
      },
    },
    dark: {
      initial: {
        opacity: 0,
        backgroundColor: SEMANTIC_COLORS.info.bg,
        borderColor: SEMANTIC_COLORS.info.border,
      },
      animate: {
        opacity: 1,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeInOut'),
      },
    },
  } as ThemeMotionVariant,
} as const

// ============================================================================
// RESPONSIVE VARIANTS
// ============================================================================

/**
 * Responsive animations that adapt to screen sizes
 */
export const responsiveVariants = {
  /** Mobile-optimized animations */
  mobile: {
    initial: { opacity: 0, transform: 'translateY(10px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-10px)' },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Tablet animations */
  tablet: {
    initial: { opacity: 0, transform: 'translateY(15px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-15px)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Desktop animations */
  desktop: {
    initial: { opacity: 0, transform: 'translateY(20px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    exit: { opacity: 0, transform: 'translateY(-20px)' },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,
} as const

// ============================================================================
// REDUCED MOTION VARIANTS
// ============================================================================

/**
 * Accessibility-friendly alternatives for reduced motion preferences
 */
export const reducedMotionVariants = {
  /** Simple opacity transition */
  opacity: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: 0.1,
      easing: getEasing('linear'),
    },
  } as MotionPreset,

  /** Instant appearance */
  instant: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: 0,
    },
  } as MotionPreset,

  /** Color-only transition */
  color: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 },
    transition: {
      duration: 0.2,
      easing: getEasing('linear'),
    },
  } as MotionPreset,
} as const

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get appropriate variant based on reduced motion preference
 */
export function getAccessibleVariant(
  normalVariant: MotionPreset,
  reducedVariant: MotionPreset = reducedMotionVariants.opacity
): MotionPreset {
  return isMotionEnabled() ? normalVariant : reducedVariant
}

/**
 * Create staggered animation for list items
 */
export function createStaggeredVariant(
  baseVariant: MotionPreset,
  staggerDelay: number = 50
): MotionPreset {
  return {
    ...baseVariant,
    transition: {
      ...baseVariant.transition,
      delay: staggerDelay / 1000,
    },
  }
}

/**
 * Create responsive variant based on screen size
 */
export function createResponsiveVariant(
  mobileVariant: MotionPreset,
  tabletVariant: MotionPreset,
  desktopVariant: MotionPreset
): { mobile: MotionPreset; tablet: MotionPreset; desktop: MotionPreset } {
  return {
    mobile: mobileVariant,
    tablet: tabletVariant,
    desktop: desktopVariant,
  }
}

/**
 * Get theme-aware variant
 */
export function getThemeVariant(
  theme: 'light' | 'dark',
  variantName: keyof typeof themeVariants
): MotionPreset {
  const variant = themeVariants[variantName]
  return variant[theme]
}

/**
 * Create custom animation preset
 */
export function createCustomVariant(config: {
  initial?: Partial<AnimatableProperties & TransformProperties>
  animate?: Partial<AnimatableProperties & TransformProperties>
  exit?: Partial<AnimatableProperties & TransformProperties>
  hover?: Partial<AnimatableProperties & TransformProperties>
  focus?: Partial<AnimatableProperties & TransformProperties>
  active?: Partial<AnimatableProperties & TransformProperties>
  disabled?: Partial<AnimatableProperties & TransformProperties>
  transition?: AnimationTransition
}): MotionPreset {
  return {
    initial: config.initial || {},
    animate: config.animate || {},
    exit: config.exit || {},
    hover: config.hover,
    focus: config.focus,
    active: config.active,
    disabled: config.disabled,
    transition: config.transition || {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  }
}

// ============================================================================
// COLLECTION-SPECIFIC VARIANTS
// ============================================================================

/**
 * Anime collection card variants
 */
export const animeCardVariants = {
  /** Grid view card */
  grid: {
    initial: { opacity: 0, transform: 'scale(0.8) translateY(20px)' },
    animate: { opacity: 1, transform: 'scale(1) translateY(0)' },
    exit: { opacity: 0, transform: 'scale(0.8) translateY(-20px)' },
    hover: {
      transform: 'scale(1.05) translateY(-8px)',
      boxShadow: '0 16px 32px rgba(0, 0, 0, 0.2)',
      zIndex: 10,
    },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** List view card */
  list: {
    initial: { opacity: 0, transform: 'translateX(-20px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    exit: { opacity: 0, transform: 'translateX(20px)' },
    hover: {
      transform: 'translateX(8px)',
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
    },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Compact card for mobile */
  compact: {
    initial: { opacity: 0, transform: 'scale(0.95)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.95)' },
    hover: {
      transform: 'scale(1.02)',
    },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,
} as const

/**
 * Search and filter variants
 */
export const searchVariants = {
  /** Search input focus */
  input: {
    initial: { transform: 'scale(1)' },
    focus: {
      transform: 'scale(1.02)',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
    },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Filter tag appearance */
  filterTag: {
    initial: { opacity: 0, transform: 'scale(0.8)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: { opacity: 0, transform: 'scale(0.8)' },
    hover: {
      transform: 'scale(1.1)',
    },
    transition: {
      duration: getDuration('fast') / 1000,
      easing: getEasing('easeOut'),
    },
  } as MotionPreset,

  /** Results container */
  results: {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

/**
 * Theme switching variants
 */
export const themeSwitchVariants = {
  /** Theme toggle button */
  toggle: {
    initial: { transform: 'rotate(0deg)' },
    animate: { transform: 'rotate(180deg)' },
    hover: {
      transform: 'rotate(90deg)',
    },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,

  /** Theme transition overlay */
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 0.3 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  } as MotionPreset,
} as const

// ============================================================================
// EXPORT ALL VARIANTS
// ============================================================================

export const MOTION_VARIANTS = {
  // Entry/Exit
  fade: fadeVariants,
  slide: slideVariants,
  scale: scaleVariants,

  // UI Components
  button: buttonVariants,
  card: cardVariants,
  modal: modalVariants,
  sidebar: sidebarVariants,
  list: listVariants,

  // Layout
  page: pageVariants,
  container: containerVariants,

  // Interactions
  hover: hoverVariants,
  focus: focusVariants,
  tap: tapVariants,

  // Loading
  loading: loadingVariants,

  // Theme-aware
  theme: themeVariants,

  // Responsive
  responsive: responsiveVariants,

  // Reduced motion
  reducedMotion: reducedMotionVariants,

  // Collection-specific
  animeCard: animeCardVariants,
  search: searchVariants,
  themeSwitch: themeSwitchVariants,
} as const

// Type exports for convenience
export type MotionVariantName = keyof typeof MOTION_VARIANTS
export type FadeVariantName = keyof typeof fadeVariants
export type SlideVariantName = keyof typeof slideVariants
export type ScaleVariantName = keyof typeof scaleVariants
export type ButtonVariantName = keyof typeof buttonVariants
export type CardVariantName = keyof typeof cardVariants
export type ModalVariantName = keyof typeof modalVariants
export type SidebarVariantName = keyof typeof sidebarVariants
export type ListVariantName = keyof typeof listVariants
export type PageVariantName = keyof typeof pageVariants
export type ContainerVariantName = keyof typeof containerVariants
export type HoverVariantName = keyof typeof hoverVariants
export type FocusVariantName = keyof typeof focusVariants
export type TapVariantName = keyof typeof tapVariants
export type LoadingVariantName = keyof typeof loadingVariants
export type ThemeVariantName = keyof typeof themeVariants
export type ResponsiveVariantName = keyof typeof responsiveVariants
export type ReducedMotionVariantName = keyof typeof reducedMotionVariants
export type AnimeCardVariantName = keyof typeof animeCardVariants
export type SearchVariantName = keyof typeof searchVariants
export type ThemeSwitchVariantName = keyof typeof themeSwitchVariants
