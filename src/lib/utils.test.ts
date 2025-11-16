import { describe, it, expect } from 'vitest'
import {
  getThemeColor,
  getSemanticColor,
  getThemeClasses,
  getTextClasses,
  getBackgroundClasses,
  getBorderClasses,
  getAccentClasses,
  getStatusClasses,
  getThemeComponentClasses,
  isDarkMode,
  getCurrentTheme,
  cn,
} from './utils'

describe('Theme Utilities', () => {
  describe('getThemeColor', () => {
    it('should return correct CSS variable for theme colors', () => {
      expect(getThemeColor('bgPrimary')).toBe('rgb(var(--bg-primary))')
      expect(getThemeColor('textSecondary')).toBe('rgb(var(--text-secondary))')
      expect(getThemeColor('accent')).toBe('rgb(var(--accent))')
    })
  })

  describe('getSemanticColor', () => {
    it('should return correct semantic colors', () => {
      expect(getSemanticColor('success', 'light')).toBe('rgb(34 197 94)')
      expect(getSemanticColor('error', 'bg')).toBe('rgb(239 68 68 / 0.1)')
      expect(getSemanticColor('warning', 'border')).toBe('rgb(234 179 8 / 0.2)')
    })

    it('should default to light variant', () => {
      expect(getSemanticColor('info')).toBe('rgb(59 130 246)')
    })
  })

  describe('getThemeClasses', () => {
    it('should combine light and dark classes', () => {
      expect(getThemeClasses('bg-white', 'bg-gray-900')).toBe(
        'bg-white dark:bg-gray-900'
      )
      expect(getThemeClasses('text-black', 'text-white')).toBe(
        'text-black dark:text-white'
      )
    })
  })

  describe('getTextClasses', () => {
    it('should return correct text classes', () => {
      expect(getTextClasses('primary')).toBe('text-foreground')
      expect(getTextClasses('secondary')).toBe('text-muted-foreground')
      expect(getTextClasses('tertiary')).toBe('text-tertiary-foreground')
    })

    it('should default to primary', () => {
      expect(getTextClasses()).toBe('text-foreground')
    })
  })

  describe('getBackgroundClasses', () => {
    it('should return correct background classes', () => {
      expect(getBackgroundClasses('primary')).toBe('background')
      expect(getBackgroundClasses('secondary')).toBe('muted')
      expect(getBackgroundClasses('tertiary')).toBe('tertiary')
    })

    it('should default to primary', () => {
      expect(getBackgroundClasses()).toBe('background')
    })
  })

  describe('getBorderClasses', () => {
    it('should return correct border classes', () => {
      expect(getBorderClasses('primary')).toBe('border')
      expect(getBorderClasses('secondary')).toBe('border')
      expect(getBorderClasses('tertiary')).toBe('border-tertiary')
    })

    it('should default to primary', () => {
      expect(getBorderClasses()).toBe('border')
    })
  })

  describe('getAccentClasses', () => {
    it('should return correct accent classes', () => {
      expect(getAccentClasses('default')).toBe('accent')
      expect(getAccentClasses('hover')).toBe('accent-hover')
      expect(getAccentClasses('foreground')).toBe('accent-foreground')
    })

    it('should default to default', () => {
      expect(getAccentClasses()).toBe('accent')
    })
  })

  describe('getStatusClasses', () => {
    it('should return correct status classes', () => {
      expect(getStatusClasses('success', 'text')).toBe(
        'text-green-600 dark:text-green-400'
      )
      expect(getStatusClasses('error', 'bg')).toBe(
        'bg-red-50 dark:bg-red-900/20'
      )
      expect(getStatusClasses('warning', 'border')).toBe(
        'border-yellow-200 dark:border-yellow-800'
      )
    })

    it('should default to text variant', () => {
      expect(getStatusClasses('info')).toBe('text-blue-600 dark:text-blue-400')
    })
  })

  describe('getThemeComponentClasses', () => {
    it('should return component classes with default options', () => {
      const classes = getThemeComponentClasses()
      expect(classes).toContain('bg-background')
      expect(classes).toContain('text-foreground')
      expect(classes).toContain('px-4')
      expect(classes).toContain('py-2')
      expect(classes).toContain('border')
    })

    it('should return muted variant classes', () => {
      const classes = getThemeComponentClasses({ variant: 'muted' })
      expect(classes).toContain('bg-muted')
      expect(classes).toContain('text-muted-foreground')
    })

    it('should return accent variant with interactive states', () => {
      const classes = getThemeComponentClasses({
        variant: 'accent',
        interactive: true,
      })
      expect(classes).toContain('bg-accent')
      expect(classes).toContain('text-accent-foreground')
      expect(classes).toContain('hover:bg-accent-hover')
      expect(classes).toContain('transition-colors')
    })

    it('should return size-specific classes', () => {
      const smallClasses = getThemeComponentClasses({ size: 'sm' })
      expect(smallClasses).toContain('px-2')
      expect(smallClasses).toContain('py-1')
      expect(smallClasses).toContain('text-sm')

      const largeClasses = getThemeComponentClasses({ size: 'lg' })
      expect(largeClasses).toContain('px-6')
      expect(largeClasses).toContain('py-3')
      expect(largeClasses).toContain('text-lg')
    })
  })

  describe('Theme Detection', () => {
    it('should return false for isDarkMode on server-side', () => {
      // Mock server-side environment
      const originalWindow = (global as typeof globalThis & { window?: Window })
        .window
      // @ts-expect-error - Intentionally deleting window for server-side test
      delete (global as typeof globalThis & { window?: Window }).window

      expect(isDarkMode()).toBe(false)

      // Restore window
      ;(global as typeof globalThis & { window?: Window }).window =
        originalWindow
    })

    it('should return light for getCurrentTheme on server-side', () => {
      // Mock server-side environment
      const originalWindow = (global as typeof globalThis & { window?: Window })
        .window
      // @ts-expect-error - Intentionally deleting window for server-side test
      delete (global as typeof globalThis & { window?: Window }).window

      expect(getCurrentTheme()).toBe('light')

      // Restore window
      ;(global as typeof globalThis & { window?: Window }).window =
        originalWindow
    })
  })

  describe('cn utility', () => {
    it('should merge classes correctly', () => {
      expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
      expect(cn('px-4', 'px-2')).toBe('px-2') // tailwind-merge should resolve conflicts
      expect(cn('bg-red-500', undefined)).toBe('bg-red-500')
    })
  })
})
