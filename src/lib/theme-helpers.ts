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
} from './theme-transitions'

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
    ? 'theme-transition-all'
    : type === 'bg'
      ? 'theme-transition-bg'
      : type === 'text'
        ? 'theme-transition-text'
        : 'theme-transition-border'
}
