/**
 * Theme transition utilities for smooth theme switching using Motion animations
 * Integrates with the Motion animation system for enhanced visual effects
 */

import { createThemeTransition as createMotionThemeTransition } from './motion-theme'
import {
  getDuration,
  getEasing,
  type MotionDuration,
  type MotionEasing,
} from './motion'

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Apply Motion-based theme transitions to document and body
 */
export function applyThemeTransitions(): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return

  const html = document.documentElement
  const body = document.body

  // Apply Motion CSS custom properties for smooth transitions
  const duration = getDuration('normal')
  const easing = getEasing('easeInOut')

  html.style.setProperty('--theme-transition-duration', `${duration}ms`)
  html.style.setProperty('--theme-transition-easing', easing)
  body.style.setProperty('--theme-transition-duration', `${duration}ms`)
  body.style.setProperty('--theme-transition-easing', easing)

  // Apply Motion-aware transition styles
  html.style.transition = `background-color var(--theme-transition-duration) var(--theme-transition-easing), color var(--theme-transition-duration) var(--theme-transition-easing), filter var(--theme-transition-duration) var(--theme-transition-easing)`
  body.style.transition = `background-color var(--theme-transition-duration) var(--theme-transition-easing), color var(--theme-transition-duration) var(--theme-transition-easing), filter var(--theme-transition-duration) var(--theme-transition-easing)`

  // Apply Motion transition classes to theme-aware elements
  const themeElements = document.querySelectorAll('*')
  themeElements.forEach((element) => {
    if (element instanceof HTMLElement) {
      const computedStyle = window.getComputedStyle(element)
      const hasThemeProperties =
        computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        computedStyle.color !== 'rgba(0, 0, 0, 0)' ||
        computedStyle.borderColor !== 'rgba(0, 0, 0, 0)'

      if (hasThemeProperties) {
        element.classList.add('motion-theme-transition')
        element.style.setProperty(
          '--theme-transition-duration',
          `${duration}ms`
        )
        element.style.setProperty('--theme-transition-easing', easing)
      }
    }
  })
}

/**
 * Remove Motion-based theme transitions from document and body
 */
export function removeThemeTransitions(): void {
  if (typeof document === 'undefined') return

  const html = document.documentElement
  const body = document.body

  // Remove inline styles
  html.style.transition = ''
  body.style.transition = ''
  html.style.removeProperty('--theme-transition-duration')
  html.style.removeProperty('--theme-transition-easing')
  body.style.removeProperty('--theme-transition-duration')
  body.style.removeProperty('--theme-transition-easing')

  // Remove Motion transition classes from all elements
  const themeElements = document.querySelectorAll(
    '.motion-theme-transition, .theme-transition-bg, .theme-transition-text, .theme-transition-border, .theme-transition-all'
  )
  themeElements.forEach((element) => {
    if (element instanceof HTMLElement) {
      element.classList.remove(
        'motion-theme-transition',
        'theme-transition-bg',
        'theme-transition-text',
        'theme-transition-border',
        'theme-transition-all'
      )
      element.style.removeProperty('--theme-transition-duration')
      element.style.removeProperty('--theme-transition-easing')
    }
  })
}

/**
 * Create a smooth Motion-based theme transition effect
 */
export function createSmoothThemeTransition(
  callback: () => void,
  options?:
    | {
        duration?: MotionDuration
        easing?: MotionEasing
        onProgress?: (progress: number) => void
        onStart?: () => void
        onEnd?: () => void
      }
    | number
): Promise<void> {
  // Handle legacy signature (callback, duration)
  let duration: MotionDuration = 'normal'
  let easing: MotionEasing = 'easeInOut'
  let onProgress: ((progress: number) => void) | undefined
  let onStart: (() => void) | undefined
  let onEnd: (() => void) | undefined

  if (typeof options === 'number') {
    // Legacy signature: createSmoothThemeTransition(callback, duration)
    duration = options as MotionDuration
  } else if (options && typeof options === 'object') {
    // New signature: createSmoothThemeTransition(callback, options)
    duration = options.duration || 'normal'
    easing = options.easing || 'easeInOut'
    onProgress = options.onProgress
    onStart = options.onStart
    onEnd = options.onEnd
  }

  // Execute callback immediately for backward compatibility
  callback()
  onStart?.()

  if (prefersReducedMotion()) {
    onEnd?.()
    return Promise.resolve()
  }

  return createMotionThemeTransition({
    duration,
    easing,
    respectReducedMotion: true,
    onTransitionStart: undefined, // Already called above
    onTransitionEnd: onEnd,
    onProgress,
  })
}

/**
 * Get transition duration based on user preferences and Motion system
 */
export function getTransitionDuration(): number {
  return prefersReducedMotion() ? 0 : getDuration('normal')
}

/**
 * Get transition easing function from Motion system
 */
export function getTransitionEasing(): string {
  return getEasing('easeInOut')
}

/**
 * Add Motion-based transition listener for theme changes
 */
export function addTransitionListener(
  element: HTMLElement,
  property: 'background-color' | 'color' | 'border-color' | 'all',
  callback: () => void
): void {
  if (prefersReducedMotion()) {
    callback()
    return
  }

  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.propertyName === property || property === 'all') {
      element.removeEventListener('transitionend', handleTransitionEnd)
      callback()
    }
  }

  element.addEventListener('transitionend', handleTransitionEnd)
}

/**
 * Monitor reduced motion preference changes
 */
export function watchReducedMotion(
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
 * Apply Motion theme transition overlay effect
 */
export function applyThemeTransitionOverlay(
  show: boolean,
  options: {
    duration?: MotionDuration
    opacity?: number
    color?: string
  } = {}
): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return

  const {
    duration = 'fast',
    opacity = 0.1,
    color = 'rgba(0, 0, 0, 0.1)',
  } = options
  const durationMs = getDuration(duration)

  let overlay = document.getElementById('theme-transition-overlay')

  if (show && !overlay) {
    overlay = document.createElement('div')
    overlay.id = 'theme-transition-overlay'
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: ${color};
      opacity: 0;
      pointer-events: none;
      z-index: 9999;
      transition: opacity ${durationMs}ms ${getEasing('easeInOut')};
    `
    document.body.appendChild(overlay)

    // Fade in
    requestAnimationFrame(() => {
      overlay!.style.opacity = opacity.toString()
    })
  } else if (!show && overlay) {
    // Fade out and remove
    overlay.style.opacity = '0'
    setTimeout(() => {
      if (overlay?.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
    }, durationMs)
  }
}

/**
 * Batch theme updates for better performance
 */
export function batchThemeUpdates(updates: (() => void)[]): Promise<void> {
  return new Promise((resolve) => {
    if (prefersReducedMotion()) {
      updates.forEach((update) => {
        update()
      })
      resolve()
      return
    }

    // Apply transitions
    applyThemeTransitions()

    // Apply overlay effect
    applyThemeTransitionOverlay(true)

    // Execute all updates
    updates.forEach((update) => {
      update()
    })

    // Wait for transition to complete
    const duration = getTransitionDuration()
    setTimeout(() => {
      applyThemeTransitionOverlay(false)
      removeThemeTransitions()
      resolve()
    }, duration)
  })
}

/**
 * Create component-aware theme transition
 */
export function createComponentThemeTransition(
  element: HTMLElement,
  fromTheme: 'light' | 'dark',
  toTheme: 'light' | 'dark',
  options: {
    duration?: MotionDuration
    easing?: MotionEasing
    onStart?: () => void
    onEnd?: () => void
  } = {}
): Promise<void> {
  const { duration = 'normal', easing = 'easeInOut', onStart, onEnd } = options

  return new Promise((resolve) => {
    if (prefersReducedMotion() || fromTheme === toTheme) {
      resolve()
      return
    }

    onStart?.()

    const durationMs = getDuration(duration)
    const easingFn = getEasing(easing)

    // Apply Motion-aware transition styles
    element.style.transition = `all ${durationMs}ms ${easingFn}`

    // Apply theme-specific filter effects
    if (toTheme === 'dark') {
      element.style.filter = 'brightness(0.8) hue-rotate(10deg)'
    } else {
      element.style.filter = 'brightness(1.1) hue-rotate(-10deg)'
    }

    // Animate to final state
    requestAnimationFrame(() => {
      element.style.filter = 'brightness(1) hue-rotate(0deg)'

      setTimeout(() => {
        element.style.transition = ''
        element.style.filter = ''
        onEnd?.()
        resolve()
      }, durationMs)
    })
  })
}

/**
 * Legacy compatibility - add theme transition class to elements
 * @deprecated Use applyThemeTransitions() instead
 */
export function addThemeTransition(
  element: HTMLElement,
  className = 'motion-theme-transition'
): void {
  if (element && !prefersReducedMotion()) {
    element.classList.add(className)
  }
}

/**
 * Legacy compatibility - remove theme transition class from elements
 * @deprecated Use removeThemeTransitions() instead
 */
export function removeThemeTransition(
  element: HTMLElement,
  className = 'motion-theme-transition'
): void {
  if (element) {
    element.classList.remove(className)
  }
}
