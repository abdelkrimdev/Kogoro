/**
 * Utility functions for the Kogoro application
 *
 * This file serves as a centralized export point for all utility modules.
 * The utilities have been split into focused modules for better maintainability
 * and improved tree-shaking.
 *
 * THEME UTILITIES USAGE GUIDE:
 *
 * 1. Basic theme colors:
 *    - getThemeColor('bgPrimary') -> 'rgb(var(--bg-primary))'
 *    - getThemeColor('textSecondary') -> 'rgb(var(--text-secondary))'
 *
 * 2. Semantic colors for status states:
 *    - getSemanticColor('success', 'bg') -> 'rgb(34 197 94 / 0.1)'
 *    - getSemanticColor('error', 'light') -> 'rgb(239 68 68)'
 *
 * 3. CSS class helpers:
 *    - getTextClasses('primary') -> 'text-foreground'
 *    - getBackgroundClasses('secondary') -> 'muted'
 *    - getBorderClasses('primary') -> 'border'
 *    - getAccentClasses('hover') -> 'accent-hover'
 *
 * 4. Status classes:
 *    - getStatusClasses('warning', 'text') -> 'text-yellow-600 dark:text-yellow-400'
 *    - getStatusClasses('error', 'bg') -> 'bg-red-50 dark:bg-red-900/20'
 *
 * 5. Component styling:
 *    - getThemeComponentClasses({ variant: 'muted', interactive: true })
 *    - getThemeClasses('bg-white', 'bg-gray-900') -> 'bg-white dark:bg-gray-900'
 *
 * 6. Theme detection:
 *    - isDarkMode() -> boolean (client-side only)
 *    - getCurrentTheme() -> 'light' | 'dark'
 */

// Re-export all utilities from their respective modules
export * from './class-utils'
export * from './theme-constants'
export * from './theme-colors'
export * from './theme-classes'
export * from './theme-helpers'
