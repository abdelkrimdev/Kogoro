/**
 * Theme class utilities for styling components
 */

import { cn } from './class-utils'

/**
 * Get theme-appropriate classes for conditional dark mode styling
 * Returns light classes for light mode and dark classes for dark mode
 */
export function getThemeClasses(
  lightClasses: string,
  darkClasses: string
): string {
  return `${lightClasses} dark:${darkClasses}`
}

/**
 * Create conditional classes based on theme state
 * This is useful when you need to apply different classes based on the current theme
 */
export function createThemeClassMap<T extends Record<string, string>>(
  classMap: T
): T {
  return classMap
}

/**
 * Get text color classes with proper contrast for the current theme
 */
export function getTextClasses(
  variant: 'primary' | 'secondary' | 'tertiary' = 'primary'
): string {
  const textMap = {
    primary: 'text-foreground',
    secondary: 'text-muted-foreground',
    tertiary: 'text-tertiary-foreground',
  }
  return textMap[variant]
}

/**
 * Get background color classes for different UI elements
 */
export function getBackgroundClasses(
  variant: 'primary' | 'secondary' | 'tertiary' = 'primary'
): string {
  const bgMap = {
    primary: 'background',
    secondary: 'muted',
    tertiary: 'tertiary',
  }
  return bgMap[variant]
}

/**
 * Get border color classes with proper theme support
 */
export function getBorderClasses(
  variant: 'primary' | 'secondary' | 'tertiary' = 'primary'
): string {
  const borderMap = {
    primary: 'border',
    secondary: 'border',
    tertiary: 'border-tertiary',
  }
  return borderMap[variant]
}

/**
 * Get accent color classes for interactive elements
 */
export function getAccentClasses(
  variant: 'default' | 'hover' | 'foreground' = 'default'
): string {
  const accentMap = {
    default: 'accent',
    hover: 'accent-hover',
    foreground: 'accent-foreground',
  }
  return accentMap[variant]
}

/**
 * Get focus ring color classes for interactive elements
 */
export function getFocusClasses(
  variant: 'default' | 'primary' | 'secondary' = 'default'
): string {
  const focusMap = {
    default: 'focus:ring-accent',
    primary: 'focus:ring-primary',
    secondary: 'focus:ring-muted-foreground',
  }
  return focusMap[variant]
}

/**
 * Create a complete theme-aware class combination for common UI patterns
 */
export function getThemeComponentClasses(
  options: {
    variant?: 'default' | 'muted' | 'accent'
    size?: 'sm' | 'md' | 'lg'
    interactive?: boolean
  } = {}
): string {
  const { variant = 'default', size = 'md', interactive = false } = options

  const baseClasses = []

  // Background and text colors based on variant
  switch (variant) {
    case 'muted':
      baseClasses.push('bg-muted text-muted-foreground')
      break
    case 'accent':
      baseClasses.push('bg-accent text-accent-foreground')
      if (interactive) baseClasses.push('hover:bg-accent-hover')
      break
    default:
      baseClasses.push('bg-background text-foreground')
      break
  }

  // Size-based padding
  switch (size) {
    case 'sm':
      baseClasses.push('px-2 py-1 text-sm')
      break
    case 'lg':
      baseClasses.push('px-6 py-3 text-lg')
      break
    default:
      baseClasses.push('px-4 py-2')
      break
  }

  // Interactive states
  if (interactive) {
    baseClasses.push('transition-colors duration-200')
    if (variant !== 'accent') {
      baseClasses.push('hover:bg-muted')
    }
  }

  // Border for most components
  baseClasses.push('border')

  return cn(...baseClasses)
}
