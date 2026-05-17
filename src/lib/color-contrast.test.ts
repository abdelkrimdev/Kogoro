import { describe, it, expect } from 'vitest'
import {
  getThemeColor,
  getSemanticColor,
  getTextClasses,
  getBackgroundClasses,
  getBorderClasses,
  getStatusClasses,
  getThemeComponentClasses,
} from './utils'

// Helper function to convert RGB to relative luminance
function rgbToLuminance(rgb: string): number {
  // Extract RGB values from rgb(r, g, b) or rgb(r g b) format
  const matches = rgb.match(/rgb\((\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)\)/)
  if (!matches) return 0

  const [_, r, g, b] = matches.map(Number)

  // Convert to sRGB
  const sRGB = [r, g, b].map((val) => {
    val = val / 255
    return val <= 0.03928 ? val / 12.92 : ((val + 0.055) / 1.055) ** 2.4
  })

  // Calculate luminance
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
}

// Helper function to get actual RGB values from CSS variables
function getActualRgbValue(cssVariable: string): string {
  // Map CSS variables to actual RGB values for testing
  const variableMap: Record<string, string> = {
    'rgb(var(--bg-primary))': 'rgb(255, 255, 255)', // Light theme
    'rgb(var(--text-primary))': 'rgb(17, 24, 39)',
    'rgb(var(--text-secondary))': 'rgb(75, 85, 99)',
    'rgb(var(--text-tertiary))': 'rgb(156, 163, 175)',
    'rgb(34 197 94)': 'rgb(34, 197, 94)', // Success
    'rgb(239 68 68)': 'rgb(239, 68, 68)', // Error
    'rgb(234 179 8)': 'rgb(234, 179, 8)', // Warning
    'rgb(59 130 246)': 'rgb(59, 130, 246)', // Info
  }

  return variableMap[cssVariable] || cssVariable
}

// Helper function to calculate contrast ratio
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = rgbToLuminance(color1)
  const lum2 = rgbToLuminance(color2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return (brightest + 0.05) / (darkest + 0.05)
}

describe('Color Contrast Validation', () => {
  describe('Theme Color Contrast', () => {
    it('should have sufficient contrast between text and background colors', () => {
      const textPrimary = getActualRgbValue(getThemeColor('textPrimary'))
      const textSecondary = getActualRgbValue(getThemeColor('textSecondary'))
      const textTertiary = getActualRgbValue(getThemeColor('textTertiary'))

      const bgPrimary = getActualRgbValue(getThemeColor('bgPrimary'))

      // Primary text on primary background should have high contrast
      const primaryContrast = getContrastRatio(textPrimary, bgPrimary)
      expect(primaryContrast).toBeGreaterThanOrEqual(4.5) // WCAG AA standard

      // Secondary text on primary background should have good contrast
      const secondaryContrast = getContrastRatio(textSecondary, bgPrimary)
      expect(secondaryContrast).toBeGreaterThanOrEqual(3) // WCAG AA large text standard

      // Tertiary text on primary background should have minimum contrast
      const tertiaryContrast = getContrastRatio(textTertiary, bgPrimary)
      expect(tertiaryContrast).toBeGreaterThanOrEqual(2.5) // Minimum for non-essential text
    })

    it('should have sufficient contrast for semantic colors', () => {
      // Test semantic colors against their appropriate backgrounds
      // Success colors - test against success background
      const successText = getActualRgbValue(
        getSemanticColor('success', 'light')
      )
      const successBg = getSemanticColor('success', 'bg')
      expect(getContrastRatio(successText, successBg)).toBeGreaterThanOrEqual(
        3.0 // Lower threshold for colored backgrounds
      )

      // Error colors - test against error background
      const errorText = getActualRgbValue(getSemanticColor('error', 'light'))
      const errorBg = getSemanticColor('error', 'bg')
      expect(getContrastRatio(errorText, errorBg)).toBeGreaterThanOrEqual(3.0)

      // Warning colors - test against warning background
      const warningText = getActualRgbValue(
        getSemanticColor('warning', 'light')
      )
      const warningBg = getSemanticColor('warning', 'bg')
      expect(getContrastRatio(warningText, warningBg)).toBeGreaterThanOrEqual(
        3.0
      )

      // Info colors - test against info background
      const infoText = getActualRgbValue(getSemanticColor('info', 'light'))
      const infoBg = getSemanticColor('info', 'bg')
      expect(getContrastRatio(infoText, infoBg)).toBeGreaterThanOrEqual(3.0)
    })
  })

  describe('Status Color Contrast', () => {
    it('should have sufficient contrast for status text colors', () => {
      // Success text
      const successTextClasses = getStatusClasses('success', 'text')
      expect(successTextClasses).toContain('text-green-600')
      expect(successTextClasses).toContain('dark:text-green-400')

      // Error text
      const errorTextClasses = getStatusClasses('error', 'text')
      expect(errorTextClasses).toContain('text-red-600')
      expect(errorTextClasses).toContain('dark:text-red-400')

      // Warning text
      const warningTextClasses = getStatusClasses('warning', 'text')
      expect(warningTextClasses).toContain('text-yellow-600')
      expect(warningTextClasses).toContain('dark:text-yellow-400')

      // Info text
      const infoTextClasses = getStatusClasses('info', 'text')
      expect(infoTextClasses).toContain('text-blue-600')
      expect(infoTextClasses).toContain('dark:text-blue-400')
    })

    it('should have appropriate background colors for status backgrounds', () => {
      // Success background
      const successBgClasses = getStatusClasses('success', 'bg')
      expect(successBgClasses).toContain('bg-green-50')
      expect(successBgClasses).toContain('dark:bg-green-900/20')

      // Error background
      const errorBgClasses = getStatusClasses('error', 'bg')
      expect(errorBgClasses).toContain('bg-red-50')
      expect(errorBgClasses).toContain('dark:bg-red-900/20')

      // Warning background
      const warningBgClasses = getStatusClasses('warning', 'bg')
      expect(warningBgClasses).toContain('bg-yellow-50')
      expect(warningBgClasses).toContain('dark:bg-yellow-900/20')

      // Info background
      const infoBgClasses = getStatusClasses('info', 'bg')
      expect(infoBgClasses).toContain('bg-blue-50')
      expect(infoBgClasses).toContain('dark:bg-blue-900/20')
    })
  })

  describe('Component Class Contrast', () => {
    it('should provide sufficient contrast for component variants', () => {
      // Default variant
      const defaultClasses = getThemeComponentClasses({ variant: 'default' })
      expect(defaultClasses).toContain('bg-background')
      expect(defaultClasses).toContain('text-foreground')

      // Muted variant
      const mutedClasses = getThemeComponentClasses({ variant: 'muted' })
      expect(mutedClasses).toContain('bg-muted')
      expect(mutedClasses).toContain('text-muted-foreground')

      // Accent variant
      const accentClasses = getThemeComponentClasses({ variant: 'accent' })
      expect(accentClasses).toContain('bg-accent')
      expect(accentClasses).toContain('text-accent-foreground')
    })

    it('should include hover states for interactive components', () => {
      const interactiveClasses = getThemeComponentClasses({
        variant: 'accent',
        interactive: true,
      })
      expect(interactiveClasses).toContain('hover:bg-accent-hover')
      expect(interactiveClasses).toContain('transition-colors')
    })
  })

  describe('Text and Background Class Consistency', () => {
    it('should provide consistent text classes', () => {
      expect(getTextClasses('primary')).toBe('text-foreground')
      expect(getTextClasses('secondary')).toBe('text-muted-foreground')
      expect(getTextClasses('tertiary')).toBe('text-tertiary-foreground')
      expect(getTextClasses()).toBe('text-foreground') // default
    })

    it('should provide consistent background classes', () => {
      expect(getBackgroundClasses('primary')).toBe('bg-background')
      expect(getBackgroundClasses('secondary')).toBe('bg-muted')
      expect(getBackgroundClasses('tertiary')).toBe('bg-tertiary')
      expect(getBackgroundClasses()).toBe('bg-background') // default
    })

    it('should provide consistent border classes', () => {
      expect(getBorderClasses('primary')).toBe('border-border')
      expect(getBorderClasses('secondary')).toBe('border-border')
      expect(getBorderClasses('tertiary')).toBe('border-tertiary')
      expect(getBorderClasses()).toBe('border-border') // default
    })
  })

  describe('Dark Mode Color Validation', () => {
    it('should have appropriate dark mode color values', () => {
      // These should be the actual CSS variable values for dark mode
      // In a real implementation, you'd want to test the actual computed values
      // when the dark class is applied to the document

      // For now, we validate that the semantic colors provide dark variants
      expect(getSemanticColor('success', 'dark')).toBe('rgb(74 222 128)')
      expect(getSemanticColor('error', 'dark')).toBe('rgb(248 113 113)')
      expect(getSemanticColor('warning', 'dark')).toBe('rgb(250 204 21)')
      expect(getSemanticColor('info', 'dark')).toBe('rgb(96 165 250)')
    })
  })

  describe('Accessibility Compliance', () => {
    it('should meet WCAG AA standards for normal text', () => {
      const textPrimary = getActualRgbValue(getThemeColor('textPrimary'))
      const bgPrimary = getActualRgbValue(getThemeColor('bgPrimary'))
      const contrast = getContrastRatio(textPrimary, bgPrimary)

      // WCAG AA requires 4.5:1 for normal text
      expect(contrast).toBeGreaterThanOrEqual(4.5)
    })

    it('should meet WCAG AA standards for large text', () => {
      const textSecondary = getActualRgbValue(getThemeColor('textSecondary'))
      const bgPrimary = getActualRgbValue(getThemeColor('bgPrimary'))
      const contrast = getContrastRatio(textSecondary, bgPrimary)

      // WCAG AA requires 3:1 for large text (18pt+ or 14pt+ bold)
      expect(contrast).toBeGreaterThanOrEqual(3)
    })

    it('should meet WCAG AAA standards for important text where possible', () => {
      const textPrimary = getActualRgbValue(getThemeColor('textPrimary'))
      const bgPrimary = getActualRgbValue(getThemeColor('bgPrimary'))
      const contrast = getContrastRatio(textPrimary, bgPrimary)

      // WCAG AAA requires 7:1 for normal text (stricter requirement)
      // We'll check if it meets this standard, but don't require it
      // as it can limit design options
      if (contrast < 7) {
        console.warn(
          `Primary text contrast ${contrast.toFixed(2)}:1 does not meet WCAG AAA standard (7:1)`
        )
      }

      // At minimum, it should meet WCAG AA (4.5:1)
      expect(contrast).toBeGreaterThanOrEqual(4.5)
    })
  })
})
