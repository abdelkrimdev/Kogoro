/**
 * Theme helper utilities for detection and responsive design
 */

import { cn } from './class-utils'
import { STATUS_COLOR_MAP, type SemanticColorType } from './theme-constants'
import { THEME_COLORS } from './theme-constants'
import {
  prefersReducedMotion,
  getTransitionDuration,
  getTransitionEasing,
  createComponentThemeTransition,
} from './theme-transitions'
import { createThemeMotion, getAnimeCollectionPreset } from './motion-theme'
import {
  getDuration,
  getEasing,
  type MotionDuration,
  type MotionEasing,
} from './motion'

/**
 * Get status color classes for different states (success, warning, error, info)
 */
export function getStatusClasses(
  status: SemanticColorType,
  variant: 'text' | 'bg' | 'border' = 'text'
): string {
  return STATUS_COLOR_MAP[status]?.[variant] || ''
}

/**
 * Utility to create responsive theme-aware classes
 */
export function getResponsiveThemeClasses(
  mobileClasses: string,
  tabletClasses: string,
  desktopClasses: string
): string {
  return cn(mobileClasses, `md:${tabletClasses}`, `lg:${desktopClasses}`)
}

/**
 * Check if the current theme is dark (client-side only)
 * Returns false on server-side
 */
export function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

/**
 * Get the current effective theme ('light' | 'dark')
 * Returns 'light' on server-side
 */
export function getCurrentTheme(): 'light' | 'dark' {
  return isDarkMode() ? 'dark' : 'light'
}

/**
 * Create theme-aware styles for inline styles (when CSS classes aren't suitable)
 */
export function getThemeStyles(property: keyof typeof THEME_COLORS): {
  [key: string]: string
} {
  return {
    [property.includes('bg')
      ? 'backgroundColor'
      : property.includes('text')
        ? 'color'
        : property.includes('border')
          ? 'borderColor'
          : 'color']: THEME_COLORS[property],
  }
}

/**
 * Create theme-aware styles with transitions
 */
export function getThemeStylesWithTransitions(
  property: keyof typeof THEME_COLORS,
  transitionType: 'all' | 'bg' | 'text' | 'border' = 'all'
): {
  [key: string]: string
} {
  const baseStyles = getThemeStyles(property)

  if (prefersReducedMotion()) {
    return baseStyles
  }

  const transitionProperty =
    transitionType === 'all'
      ? 'all'
      : transitionType === 'bg'
        ? 'background-color'
        : transitionType === 'text'
          ? 'color'
          : 'border-color'

  return {
    ...baseStyles,
    transition: `${transitionProperty} ${getTransitionDuration()}ms ${getTransitionEasing()}`,
  }
}

/**
 * Apply theme transitions to an element
 */
export function applyElementThemeTransitions(
  element: HTMLElement,
  options: {
    background?: boolean
    text?: boolean
    border?: boolean
    all?: boolean
  } = {}
): void {
  if (!element || prefersReducedMotion()) return

  const transitions: string[] = []

  if (options.all) {
    transitions.push('all')
  } else {
    if (options.background) transitions.push('background-color')
    if (options.text) transitions.push('color')
    if (options.border) transitions.push('border-color')
  }

  if (transitions.length > 0) {
    element.style.transition = `${transitions.join(', ')} ${getTransitionDuration()}ms ${getTransitionEasing()}`
  }
}

/**
 * Get theme transition class names
 */
export function getThemeTransitionClasses(
  type: 'all' | 'bg' | 'text' | 'border' = 'all'
): string {
  if (prefersReducedMotion()) return ''

  return type === 'all'
    ? 'motion-theme-transition theme-transition-all'
    : type === 'bg'
      ? 'motion-theme-transition theme-transition-bg'
      : type === 'text'
        ? 'motion-theme-transition theme-transition-text'
        : 'motion-theme-transition theme-transition-border'
}

/**
 * Create Motion-aware theme transition for a component
 */
export function createMotionThemeTransition(
  element: HTMLElement,
  fromTheme: 'light' | 'dark',
  toTheme: 'light' | 'dark',
  options: {
    duration?: MotionDuration
    easing?: MotionEasing
    preset?: keyof ReturnType<typeof createThemeMotion>['animePresets']
  } = {}
): Promise<void> {
  const { duration = 'normal', easing = 'easeInOut', preset } = options

  if (prefersReducedMotion() || fromTheme === toTheme) {
    return Promise.resolve()
  }

  // Apply preset-specific animation if provided
  if (preset) {
    const animePreset = getAnimeCollectionPreset(preset, toTheme)
    const durationMs = getDuration(duration)
    const easingFn = getEasing(easing)

    element.style.transition = `all ${durationMs}ms ${easingFn}`

    // Apply preset animation properties
    Object.assign(element.style, animePreset.animate)
  }

  return createComponentThemeTransition(element, fromTheme, toTheme, {
    duration,
    easing,
  })
}

/**
 * Apply Motion theme classes to an element
 */
export function applyMotionThemeClasses(
  element: HTMLElement,
  variant: 'subtle' | 'vibrant' | 'dramatic' = 'subtle',
  options: {
    respectReducedMotion?: boolean
    duration?: MotionDuration
    easing?: MotionEasing
  } = {}
): void {
  const {
    respectReducedMotion = true,
    duration = 'normal',
    easing = 'easeInOut',
  } = options

  if (!element || (respectReducedMotion && prefersReducedMotion())) return

  const _themeMotion = createThemeMotion()
  const durationMs = getDuration(duration)
  const easingFn = getEasing(easing)

  // Add Motion theme classes
  element.classList.add('motion-theme-transition', `motion-theme-${variant}`)

  // Apply CSS custom properties
  element.style.setProperty('--motion-theme-duration', `${durationMs}ms`)
  element.style.setProperty('--motion-theme-easing', easingFn)

  // Apply variant-specific styles
  switch (variant) {
    case 'vibrant':
      element.style.setProperty(
        '--motion-filter',
        'brightness(1.05) saturate(1.1)'
      )
      break
    case 'dramatic':
      element.style.setProperty(
        '--motion-filter',
        'brightness(1.1) contrast(1.05)'
      )
      break
    default:
      element.style.setProperty('--motion-filter', 'brightness(1)')
  }
}

/**
 * Remove Motion theme classes from an element
 */
export function removeMotionThemeClasses(
  element: HTMLElement,
  variant: 'subtle' | 'vibrant' | 'dramatic' = 'subtle'
): void {
  if (!element) return

  element.classList.remove('motion-theme-transition', `motion-theme-${variant}`)
  element.style.removeProperty('--motion-theme-duration')
  element.style.removeProperty('--motion-theme-easing')
  element.style.removeProperty('--motion-filter')
}

/**
 * Batch theme updates with Motion animations
 */
export function batchMotionThemeUpdates(
  updates: Array<{
    element: HTMLElement
    fromTheme: 'light' | 'dark'
    toTheme: 'light' | 'dark'
    options?: {
      duration?: MotionDuration
      easing?: MotionEasing
      preset?: keyof ReturnType<typeof createThemeMotion>['animePresets']
    }
  }>
): Promise<void> {
  if (prefersReducedMotion()) {
    // Apply updates immediately without animations
    updates.forEach(({ element, toTheme }) => {
      // Direct theme change without animation
      if (toTheme === 'dark') {
        element.classList.add('dark')
        element.classList.remove('light')
      } else {
        element.classList.add('light')
        element.classList.remove('dark')
      }
    })
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    // Apply Motion transitions to all elements
    const transitions = updates.map(
      ({ element, fromTheme, toTheme, options }) =>
        createMotionThemeTransition(element, fromTheme, toTheme, options)
    )

    // Wait for all transitions to complete
    Promise.all(transitions).then(() => resolve())
  })
}

/**
 * Get Motion-aware theme styles for inline styles
 */
export function getMotionThemeStyles(
  property: keyof typeof THEME_COLORS,
  options: {
    transition?: boolean
    duration?: MotionDuration
    easing?: MotionEasing
    variant?: 'subtle' | 'vibrant' | 'dramatic'
  } = {}
): { [key: string]: string } {
  const {
    transition = false,
    duration = 'normal',
    easing = 'easeInOut',
    variant = 'subtle',
  } = options

  const baseStyles = getThemeStyles(property)

  if (!transition || prefersReducedMotion()) {
    return baseStyles
  }

  const durationMs = getDuration(duration)
  const easingFn = getEasing(easing)

  const transitionStyles = {
    transition: `all ${durationMs}ms ${easingFn}`,
    '--motion-theme-duration': `${durationMs}ms`,
    '--motion-theme-easing': easingFn,
  }

  // Add variant-specific filter effects
  switch (variant) {
    case 'vibrant':
      transitionStyles['--motion-filter'] = 'brightness(1.05) saturate(1.1)'
      break
    case 'dramatic':
      transitionStyles['--motion-filter'] = 'brightness(1.1) contrast(1.05)'
      break
    default:
      transitionStyles['--motion-filter'] = 'brightness(1)'
  }

  return {
    ...baseStyles,
    ...transitionStyles,
  }
}

/**
 * Create theme transition callback with Motion support
 */
export function createThemeTransitionCallback(
  callback: () => void,
  options: {
    duration?: MotionDuration
    easing?: MotionEasing
    overlay?: boolean
    onStart?: () => void
    onEnd?: () => void
  } = {}
): () => Promise<void> {
  const {
    duration = 'normal',
    easing = 'easeInOut',
    overlay = false,
    onStart,
    onEnd,
  } = options

  return () => {
    return new Promise((resolve) => {
      if (prefersReducedMotion()) {
        callback()
        resolve()
        return
      }

      onStart?.()

      // Apply overlay if requested
      if (overlay) {
        const overlayElement = document.createElement('div')
        overlayElement.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.05);
          opacity: 0;
          pointer-events: none;
          z-index: 9999;
          transition: opacity ${getDuration(duration)}ms ${getEasing(easing)};
        `
        document.body.appendChild(overlayElement)

        requestAnimationFrame(() => {
          overlayElement.style.opacity = '1'
        })

        setTimeout(() => {
          overlayElement.style.opacity = '0'
          setTimeout(() => {
            if (overlayElement.parentNode) {
              overlayElement.parentNode.removeChild(overlayElement)
            }
          }, getDuration(duration))
        }, 50)
      }

      // Execute the callback
      callback()

      // Wait for transition to complete
      setTimeout(() => {
        onEnd?.()
        resolve()
      }, getDuration(duration))
    })
  }
}

/**
 * Check if Motion theme transitions are supported
 */
export function isMotionThemeSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof CSS !== 'undefined' &&
    CSS.supports('transition', 'all 0.3s ease') &&
    !prefersReducedMotion()
  )
}

/**
 * Get Motion theme configuration
 */
export function getMotionThemeConfig() {
  return {
    isSupported: isMotionThemeSupported(),
    prefersReduced: prefersReducedMotion(),
    duration: getDuration('normal'),
    easing: getEasing('easeInOut'),
    presets: createThemeMotion().animePresets,
  }
}
