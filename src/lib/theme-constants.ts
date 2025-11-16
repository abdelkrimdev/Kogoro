/**
 * Theme constants and type definitions
 */

/**
 * Theme color tokens mapped to their CSS variable names
 */
export const THEME_COLORS = {
  // Background colors
  bgPrimary: 'rgb(var(--bg-primary))',
  bgSecondary: 'rgb(var(--bg-secondary))',
  bgTertiary: 'rgb(var(--bg-tertiary))',

  // Text colors
  textPrimary: 'rgb(var(--text-primary))',
  textSecondary: 'rgb(var(--text-secondary))',
  textTertiary: 'rgb(var(--text-tertiary))',

  // Border colors
  borderPrimary: 'rgb(var(--border-primary))',
  borderSecondary: 'rgb(var(--border-secondary))',
  borderTertiary: 'rgb(var(--border-tertiary))',

  // Accent colors
  accent: 'rgb(var(--accent))',
  accentHover: 'rgb(var(--accent-hover))',
  accentForeground: 'rgb(var(--bg-primary))',
} as const

/**
 * Semantic color mappings for different UI states
 */
export const SEMANTIC_COLORS = {
  // Success colors (green-based)
  success: {
    light: 'rgb(34 197 94)', // green-500
    dark: 'rgb(74 222 128)', // green-400
    bg: 'rgb(34 197 94 / 0.1)', // green-500/10
    border: 'rgb(34 197 94 / 0.2)', // green-500/20
  },

  // Warning colors (yellow-based)
  warning: {
    light: 'rgb(234 179 8)', // yellow-500
    dark: 'rgb(250 204 21)', // yellow-400
    bg: 'rgb(234 179 8 / 0.1)', // yellow-500/10
    border: 'rgb(234 179 8 / 0.2)', // yellow-500/20
  },

  // Error colors (red-based)
  error: {
    light: 'rgb(239 68 68)', // red-500
    dark: 'rgb(248 113 113)', // red-400
    bg: 'rgb(239 68 68 / 0.1)', // red-500/10
    border: 'rgb(239 68 68 / 0.2)', // red-500/20
  },

  // Info colors (blue-based)
  info: {
    light: 'rgb(59 130 246)', // blue-500
    dark: 'rgb(96 165 250)', // blue-400
    bg: 'rgb(59 130 246 / 0.1)', // blue-500/10
    border: 'rgb(59 130 246 / 0.2)', // blue-500/20
  },
} as const

/**
 * Status color mappings for different variants
 */
export const STATUS_COLOR_MAP = {
  success: {
    text: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
  },
  warning: {
    text: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  error: {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
  },
  info: {
    text: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
  },
} as const

/**
 * Type definitions for theme utilities
 */
export type ThemeColor = keyof typeof THEME_COLORS
export type SemanticColorType = keyof typeof SEMANTIC_COLORS
export type SemanticColorVariant = 'light' | 'dark' | 'bg' | 'border'
