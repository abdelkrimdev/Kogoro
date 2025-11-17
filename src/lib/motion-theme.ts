/**
 * Theme-aware motion utilities for Kogoro
 * Bridges the Motion animation system with the existing theme system
 * Provides smooth, visually appealing theme transitions with accessibility support
 */

import { createSignal, onCleanup } from 'solid-js'
import {
  THEME_COLORS,
  SEMANTIC_COLORS,
  type ThemeColor,
  type SemanticColorType,
} from './theme-constants'
import { getCurrentTheme } from './theme-helpers'
import {
  MOTION_PRESETS,
  THEME_MOTION_VARIANTS,
  getDuration,
  getEasing,
  getDelay,
  isMotionEnabled,
  type MotionDuration,
  type MotionEasing,
  type MotionDelay,
} from './motion'
import { prefersReducedMotion, watchReducedMotion } from './theme-transitions'
import type {
  AnimationVariant,
  ThemeMotionVariant,
  MotionState,
  AnimationTransition,
  AnimatableProperties,
  TransformProperties,
  MotionPreset,
} from '../types/motion'

/**
 * Theme-aware animation state
 */
interface ThemeMotionState extends MotionState {
  currentTheme: 'light' | 'dark'
  isTransitioning: boolean
  transitionProgress: number
}

/**
 * Theme transition animation configuration
 */
interface ThemeTransitionConfig {
  duration?: MotionDuration
  easing?: MotionEasing
  delay?: MotionDelay
  respectReducedMotion?: boolean
  onTransitionStart?: () => void
  onTransitionEnd?: () => void
  onProgress?: (progress: number) => void
}

/**
 * Color-aware animation configuration
 */
interface ColorAnimationConfig {
  fromColor: ThemeColor | SemanticColorType
  toColor?: ThemeColor | SemanticColorType
  property: 'backgroundColor' | 'color' | 'borderColor' | 'all'
  duration?: MotionDuration
  easing?: MotionEasing
  respectReducedMotion?: boolean
}

/**
 * Extended animation variant with transition support
 */
interface ExtendedAnimationVariant extends AnimationVariant {
  transition?: AnimationTransition
}

/**
 * Theme-aware motion state
 */
const [themeMotionState, setThemeMotionState] = createSignal<ThemeMotionState>({
  reducedMotion: false,
  enabled: true,
  currentTheme: 'light',
  isTransitioning: false,
  transitionProgress: 0,
})

/**
 * Initialize theme-aware motion system
 */
export function initializeThemeMotion(): void {
  if (typeof window === 'undefined') return

  // Set initial state
  setThemeMotionState({
    reducedMotion: prefersReducedMotion(),
    enabled: true,
    currentTheme: getCurrentTheme(),
    isTransitioning: false,
    transitionProgress: 0,
  })

  // Watch for reduced motion changes
  const cleanupReducedMotion = watchReducedMotion((prefersReduced) => {
    setThemeMotionState((prev) => ({
      ...prev,
      reducedMotion: prefersReduced,
    }))
  })

  // Watch for theme changes
  const observer = new MutationObserver(() => {
    const newTheme = getCurrentTheme()
    setThemeMotionState((prev) => {
      if (prev.currentTheme !== newTheme) {
        return {
          ...prev,
          currentTheme: newTheme,
          isTransitioning: true,
          transitionProgress: 0,
        }
      }
      return prev
    })
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  onCleanup(() => {
    cleanupReducedMotion()
    observer.disconnect()
  })
}

/**
 * Get current theme motion state
 */
export function getThemeMotionState(): ThemeMotionState {
  return themeMotionState()
}

/**
 * Check if theme-aware animations are enabled
 */
export function isThemeMotionEnabled(): boolean {
  const state = getThemeMotionState()
  return state.enabled && !state.reducedMotion
}

/**
 * Create theme-aware animation preset
 */
export function createThemeMotionPreset(
  lightVariant: Partial<ExtendedAnimationVariant>,
  darkVariant: Partial<ExtendedAnimationVariant>
): ThemeMotionVariant {
  const basePreset: ExtendedAnimationVariant = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: getDuration('normal') / 1000,
      easing: getEasing('easeInOut'),
    },
  }

  const createPreset = (
    variant: Partial<ExtendedAnimationVariant>
  ): MotionPreset => {
    return {
      initial: {
        ...basePreset.initial,
        ...variant.initial,
      },
      animate: {
        ...basePreset.animate,
        ...variant.animate,
      },
      exit: {
        ...basePreset.exit,
        ...variant.exit,
      },
      transition: {
        ...basePreset.transition,
        ...variant.transition,
      },
    }
  }

  return {
    light: createPreset(lightVariant),
    dark: createPreset(darkVariant),
  }
}

/**
 * Get theme-aware animation preset
 */
export function getThemeMotionPreset(
  presetName: keyof typeof MOTION_PRESETS,
  theme?: 'light' | 'dark'
): MotionPreset {
  const currentTheme = theme || getCurrentTheme()
  const basePreset = MOTION_PRESETS[presetName]

  // Apply theme-specific adjustments
  const themeAdjustments = THEME_MOTION_VARIANTS[currentTheme]

  return {
    ...basePreset,
    initial: {
      ...basePreset.initial,
      ...themeAdjustments.subtle.initial,
    },
    animate: {
      ...basePreset.animate,
      ...themeAdjustments.subtle.animate,
    },
    transition: {
      ...basePreset.transition,
      ...themeAdjustments.subtle.transition,
    },
  }
}

/**
 * Create smooth theme transition animation
 */
export function createThemeTransition(
  config: ThemeTransitionConfig = {}
): Promise<void> {
  return new Promise((resolve) => {
    const {
      duration = 'normal',
      delay = 'none',
      respectReducedMotion = true,
      onTransitionStart,
      onTransitionEnd,
      onProgress,
    } = config

    // Skip animation if reduced motion is preferred
    if (respectReducedMotion && prefersReducedMotion()) {
      onTransitionStart?.()
      onTransitionEnd?.()
      resolve()
      return
    }

    onTransitionStart?.()

    // Update state
    setThemeMotionState((prev) => ({
      ...prev,
      isTransitioning: true,
      transitionProgress: 0,
    }))

    const durationMs = getDuration(duration)
    const delayMs = getDelay(delay)
    const startTime = Date.now() + delayMs

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)

      setThemeMotionState((prev) => ({
        ...prev,
        transitionProgress: progress,
      }))

      onProgress?.(progress)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setThemeMotionState((prev) => ({
          ...prev,
          isTransitioning: false,
          transitionProgress: 1,
        }))
        onTransitionEnd?.()
        resolve()
      }
    }

    // Start animation after delay
    if (delayMs > 0) {
      setTimeout(() => requestAnimationFrame(animate), delayMs)
    } else {
      requestAnimationFrame(animate)
    }
  })
}

/**
 * Create color-aware animation
 */
export function createColorAnimation(
  config: ColorAnimationConfig
): ExtendedAnimationVariant {
  const {
    fromColor,
    toColor,
    property = 'all',
    duration = 'normal',
    respectReducedMotion = true,
  } = config

  if (respectReducedMotion && prefersReducedMotion()) {
    return {}
  }

  const getThemeColor = (color: ThemeColor | SemanticColorType): string => {
    if (color in THEME_COLORS) {
      return THEME_COLORS[color as ThemeColor]
    }
    if (color in SEMANTIC_COLORS) {
      const semanticColor = SEMANTIC_COLORS[color as SemanticColorType]
      return semanticColor.light // Default to light variant
    }
    return 'rgb(var(--bg-primary))'
  }

  const from = getThemeColor(fromColor)
  const to = toColor ? getThemeColor(toColor) : from

  const properties: Record<string, string> = {}

  if (property === 'all' || property === 'backgroundColor') {
    properties.backgroundColor = from
  }
  if (property === 'all' || property === 'color') {
    properties.color = from
  }
  if (property === 'all' || property === 'borderColor') {
    properties.borderColor = from
  }

  return {
    initial: properties,
    animate:
      property === 'all'
        ? { backgroundColor: to, color: to, borderColor: to }
        : { [property]: to },
    transition: {
      duration: getDuration(duration) / 1000,
      easing: getEasing('easeInOut'),
    },
  }
}

/**
 * Get theme-aware CSS custom properties for animations
 */
export function getThemeMotionCSS(): string {
  const state = getThemeMotionState()
  const theme = state.currentTheme

  return `
    :root {
      --motion-theme-duration: ${getDuration('normal')}ms;
      --motion-theme-easing: ${getEasing('easeInOut')};
      --motion-theme-delay: ${getDelay('none')}ms;
    }
    
    ${
      theme === 'dark'
        ? `
      .theme-motion-subtle {
        opacity: 0.9;
        transition: opacity var(--motion-theme-duration) var(--motion-theme-easing);
      }
      
      .theme-motion-vibrant {
        filter: brightness(1.1);
        transition: filter var(--motion-theme-duration) var(--motion-theme-easing);
      }
    `
        : `
      .theme-motion-subtle {
        opacity: 0.95;
        transition: opacity var(--motion-theme-duration) var(--motion-theme-easing);
      }
      
      .theme-motion-vibrant {
        filter: brightness(0.95);
        transition: filter var(--motion-theme-duration) var(--motion-theme-easing);
      }
    `
    }
    
    ${
      !isMotionEnabled()
        ? `
      .theme-motion-subtle,
      .theme-motion-vibrant {
        transition: none !important;
        animation: none !important;
      }
    `
        : ''
    }
  `
}

/**
 * Apply theme-aware motion classes to element
 */
export function applyThemeMotionClasses(
  element: HTMLElement,
  variant: 'subtle' | 'vibrant' = 'subtle'
): void {
  if (!(element && isThemeMotionEnabled())) return

  // Add theme-specific classes
  element.classList.add('theme-motion-subtle')

  if (variant === 'vibrant') {
    element.classList.add('theme-motion-vibrant')
  }

  // Apply CSS custom properties
  element.style.setProperty(
    '--motion-theme-duration',
    `${getDuration('normal')}ms`
  )
  element.style.setProperty('--motion-theme-easing', getEasing('easeInOut'))
}

/**
 * Remove theme-aware motion classes from element
 */
export function removeThemeMotionClasses(
  element: HTMLElement,
  variant: 'subtle' | 'vibrant' = 'subtle'
): void {
  if (!element) return

  element.classList.remove('theme-motion-subtle')

  if (variant === 'vibrant') {
    element.classList.remove('theme-motion-vibrant')
  }

  // Remove CSS custom properties
  element.style.removeProperty('--motion-theme-duration')
  element.style.removeProperty('--motion-theme-easing')
}

/**
 * Theme-aware animation presets for anime collection management
 */
export const ANIME_COLLECTION_MOTION_PRESETS = {
  // Anime card animations
  animeCard: createThemeMotionPreset(
    {
      initial: {
        opacity: 0,
        transform: 'translateY(20px) scale(0.95)',
        filter: 'brightness(0.9)',
      },
      animate: {
        opacity: 1,
        transform: 'translateY(0) scale(1)',
        filter: 'brightness(1)',
      },
      exit: {
        opacity: 0,
        transform: 'translateY(-20px) scale(0.95)',
        filter: 'brightness(0.9)',
      },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeOut'),
      },
    },
    {
      initial: {
        opacity: 0,
        transform: 'translateY(20px) scale(0.95)',
        filter: 'brightness(1.1)',
      },
      animate: {
        opacity: 1,
        transform: 'translateY(0) scale(1)',
        filter: 'brightness(1)',
      },
      exit: {
        opacity: 0,
        transform: 'translateY(-20px) scale(0.95)',
        filter: 'brightness(1.1)',
      },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeOut'),
      },
    }
  ),

  // Episode list animations
  episodeItem: createThemeMotionPreset(
    {
      initial: {
        opacity: 0,
        transform: 'translateX(-20px)',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
      },
      animate: {
        opacity: 1,
        transform: 'translateX(0)',
        backgroundColor: 'rgba(0, 0, 0, 0)',
      },
      exit: {
        opacity: 0,
        transform: 'translateX(20px)',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
      },
      transition: {
        duration: getDuration('fast') / 1000,
        easing: getEasing('easeOut'),
      },
    },
    {
      initial: {
        opacity: 0,
        transform: 'translateX(-20px)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
      },
      animate: {
        opacity: 1,
        transform: 'translateX(0)',
        backgroundColor: 'rgba(255, 255, 255, 0)',
      },
      exit: {
        opacity: 0,
        transform: 'translateX(20px)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
      },
      transition: {
        duration: getDuration('fast') / 1000,
        easing: getEasing('easeOut'),
      },
    }
  ),

  // Search results animations
  searchResult: createThemeMotionPreset(
    {
      initial: {
        opacity: 0,
        transform: 'scale(0.98)',
        boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
      },
      animate: {
        opacity: 1,
        transform: 'scale(1)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      },
      exit: {
        opacity: 0,
        transform: 'scale(0.98)',
        boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
      },
      transition: {
        duration: getDuration('fast') / 1000,
        easing: getEasing('easeOut'),
      },
    },
    {
      initial: {
        opacity: 0,
        transform: 'scale(0.98)',
        boxShadow: '0 0 0 rgba(255, 255, 255, 0)',
      },
      animate: {
        opacity: 1,
        transform: 'scale(1)',
        boxShadow: '0 4px 6px rgba(255, 255, 255, 0.1)',
      },
      exit: {
        opacity: 0,
        transform: 'scale(0.98)',
        boxShadow: '0 0 0 rgba(255, 255, 255, 0)',
      },
      transition: {
        duration: getDuration('fast') / 1000,
        easing: getEasing('easeOut'),
      },
    }
  ),

  // Collection grid animations
  collectionGrid: createThemeMotionPreset(
    {
      initial: {
        opacity: 0,
        transform: 'translateY(30px) scale(0.9)',
        filter: 'blur(2px)',
      },
      animate: {
        opacity: 1,
        transform: 'translateY(0) scale(1)',
        filter: 'blur(0px)',
      },
      exit: {
        opacity: 0,
        transform: 'translateY(-30px) scale(0.9)',
        filter: 'blur(2px)',
      },
      transition: {
        duration: getDuration('slow') / 1000,
        easing: getEasing('easeOut'),
      },
    },
    {
      initial: {
        opacity: 0,
        transform: 'translateY(30px) scale(0.9)',
        filter: 'blur(1px)',
      },
      animate: {
        opacity: 1,
        transform: 'translateY(0) scale(1)',
        filter: 'blur(0px)',
      },
      exit: {
        opacity: 0,
        transform: 'translateY(-30px) scale(0.9)',
        filter: 'blur(1px)',
      },
      transition: {
        duration: getDuration('slow') / 1000,
        easing: getEasing('easeOut'),
      },
    }
  ),

  // Theme switching animations
  themeSwitch: {
    light: {
      initial: {
        opacity: 1,
        filter: 'brightness(1) hue-rotate(0deg)',
      },
      animate: {
        opacity: 1,
        filter: 'brightness(1) hue-rotate(0deg)',
      },
      exit: {
        opacity: 1,
        filter: 'brightness(1) hue-rotate(0deg)',
      },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeInOut'),
      },
    },
    dark: {
      initial: {
        opacity: 1,
        filter: 'brightness(0.8) hue-rotate(10deg)',
      },
      animate: {
        opacity: 1,
        filter: 'brightness(1) hue-rotate(0deg)',
      },
      exit: {
        opacity: 1,
        filter: 'brightness(0.8) hue-rotate(10deg)',
      },
      transition: {
        duration: getDuration('normal') / 1000,
        easing: getEasing('easeInOut'),
      },
    },
  },
} as const

/**
 * Get anime collection motion preset
 */
export function getAnimeCollectionPreset(
  presetName: keyof typeof ANIME_COLLECTION_MOTION_PRESETS,
  theme?: 'light' | 'dark'
): MotionPreset {
  const currentTheme = theme || getCurrentTheme()
  const preset = ANIME_COLLECTION_MOTION_PRESETS[presetName]

  if ('light' in preset && 'dark' in preset) {
    return preset[currentTheme]
  }

  return preset as MotionPreset
}

/**
 * Create staggered animation for list items
 */
export function createStaggeredAnimation(
  basePreset: MotionPreset,
  itemCount: number,
  staggerDelay: number = 50
): MotionPreset[] {
  return Array.from({ length: itemCount }, (_, index) => ({
    ...basePreset,
    transition: {
      ...basePreset.transition,
      delay: (index * staggerDelay) / 1000,
    },
  }))
}

/**
 * Performance optimization for theme transitions
 */
export function optimizeThemeTransitions(): void {
  if (typeof window === 'undefined') return

  // Reduce motion during heavy operations
  const heavyOperations = ['scroll', 'resize', 'wheel']

  const handleHeavyOperation = () => {
    document.body.style.setProperty('--motion-theme-duration', '0ms')
  }

  const handleHeavyOperationEnd = () => {
    setTimeout(() => {
      document.body.style.setProperty(
        '--motion-theme-duration',
        `${getDuration('normal')}ms`
      )
    }, 100)
  }

  heavyOperations.forEach((operation) => {
    document.addEventListener(operation, handleHeavyOperation, {
      passive: true,
    })
    document.addEventListener(`${operation}end`, handleHeavyOperationEnd, {
      passive: true,
    })
  })
}

/**
 * Hook for using theme-aware motion in components
 */
export function createThemeMotion() {
  return {
    state: getThemeMotionState,
    isEnabled: isThemeMotionEnabled,
    getCurrentTheme: () => getThemeMotionState().currentTheme,
    isTransitioning: () => getThemeMotionState().isTransitioning,
    getTransitionProgress: () => getThemeMotionState().transitionProgress,

    // Animation utilities
    createTransition: createThemeTransition,
    createColorAnimation,
    getPreset: getThemeMotionPreset,
    getAnimePreset: getAnimeCollectionPreset,
    createStaggered: createStaggeredAnimation,

    // CSS utilities
    getCSS: getThemeMotionCSS,
    applyClasses: applyThemeMotionClasses,
    removeClasses: removeThemeMotionClasses,

    // Presets
    presets: MOTION_PRESETS,
    animePresets: ANIME_COLLECTION_MOTION_PRESETS,
    themeVariants: THEME_MOTION_VARIANTS,

    // Performance
    optimize: optimizeThemeTransitions,
  }
}

/**
 * Re-export commonly used utilities
 */
export {
  prefersReducedMotion,
  watchReducedMotion,
} from './theme-transitions'

export {
  getDuration,
  getEasing,
  getDelay,
  isMotionEnabled,
} from './motion'

export { getCurrentTheme } from './theme-helpers'

/**
 * Types for TypeScript integration
 */
export type {
  ThemeMotionState,
  ThemeTransitionConfig,
  ColorAnimationConfig,
  ThemeMotionVariant,
  AnimationVariant,
  AnimationTransition,
  MotionPreset,
  ExtendedAnimationVariant,
  AnimatableProperties,
  TransformProperties,
}
