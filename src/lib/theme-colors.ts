/**
 * Theme color utilities
 */

import {
  THEME_COLORS,
  SEMANTIC_COLORS,
  type ThemeColor,
  type SemanticColorType,
  type SemanticColorVariant,
} from './theme-constants'

/**
 * Get a theme color value by key
 */
export function getThemeColor(color: ThemeColor): string {
  return THEME_COLORS[color]
}

/**
 * Get a semantic color value based on the current theme
 */
export function getSemanticColor(
  type: SemanticColorType,
  variant: SemanticColorVariant = 'light'
): string {
  return SEMANTIC_COLORS[type][variant]
}
