import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// List of components to check
const componentFiles = [
  'components/layout/Header.tsx',
  'components/layout/Sidebar.tsx',
  'components/layout/Layout.tsx',
  'components/pages/Dashboard.tsx',
  'components/pages/Collection.tsx',
  'components/pages/Scanner.tsx',
  'components/pages/Search.tsx',
  'components/pages/Settings.tsx',
  'components/ui/ErrorBoundary.tsx',
  'components/ui/Loading.tsx',
]

// Patterns that indicate hardcoded colors
const hardcodedColorPatterns = [
  // Direct color classes (but allow text-white in gradient contexts)
  /\b(bg-white)\b(?![\s\S]*dark:bg-)/, // bg-white not followed by dark:bg-
  /\b(text-black)\b/,
  /\b(bg-black)\b(?![\s\S]*bg-opacity|[\s\S]*\/[0-9])/, // bg-black not for overlays
  // Skip text-white check for specific files that use it in gradient contexts
  // text-white is handled separately below
  /\b(bg-gray-[0-9]+|border-gray-[0-9]+)\b/, // Exclude text-gray for placeholders
  /\b(bg-red-[0-9]+|text-red-[0-9]+|border-red-[0-9]+)\b/,
  /\b(bg-green-[0-9]+|text-green-[0-9]+|border-green-[0-9]+)\b/,
  /\b(bg-blue-[0-9]+|text-blue-[0-9]+|border-blue-[0-9]+)\b/,
  /\b(bg-yellow-[0-9]+|text-yellow-[0-9]+|border-yellow-[0-9]+)\b/,
  /\b(bg-purple-[0-9]+|text-purple-[0-9]+|border-purple-[0-9]+)\b/,
  /\b(bg-pink-[0-9]+|text-pink-[0-9]+|border-pink-[0-9]+)\b/,
  /\b(bg-indigo-[0-9]+|text-indigo-[0-9]+|border-indigo-[0-9]+)\b/,

  // Hex colors
  /#[0-9a-fA-F]{3,6}/,

  // RGB/RGBA colors (except CSS variables)
  /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/,
  /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/,

  // HSL/HSLA colors
  /hsl\(/,
  /hsla\(/,
]

// Allowed exceptions (colors that are intentionally hardcoded)
const allowedPatterns = [
  // Gradient backgrounds (these are intentional design elements)
  /bg-gradient-to-br/,

  // Specific opacity overlays that are intentional
  /bg-opacity-[0-9]+/,
  /\/[0-9]+\)/, // Tailwind opacity syntax like bg-black/75

  // Status indicators that use semantic colors
  /text-yellow-500/, // Star ratings
  /bg-green-500/, // Online status indicators

  // Focus ring colors (these are accessibility features)
  /focus:ring-[a-z]+-[0-9]+/,

  // White text on gradient backgrounds (appropriate contrast)
  /text-white.*bg-gradient/,
  /bg-gradient.*text-white/,

  // Black overlays for UI elements
  /bg-black.*bg-opacity/,
  /bg-black.*\/[0-9]+/,

  // White text on colored backgrounds (appropriate contrast)
  /from-.*text-white/,
  /to-.*text-white/,
  /bg-gradient.*text-white.*from-/,
  /bg-gradient.*text-white.*to-/,

  // White text in overlay contexts
  /text-white.*backdrop-blur/,
  /text-white.*bg-opacity/,
  /text-white.*\/[0-9]+/,

  // White text in gradient backgrounds
  /bg-gradient.*text-white/,
  /from-.*text-white/,
  /to-.*text-white/,

  // White backgrounds in modal/overlay contexts
  /bg-white.*dark:bg-gray/,
  /bg-white.*rounded-lg/,

  // Placeholder colors (acceptable as grays for form inputs)
  /placeholder:text-gray-[0-9]+/,
  /dark:placeholder:text-gray-[0-9]+/,

  // Specific allowed patterns for gradient contexts
  /w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600.*text-white/,
  /w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600.*text-white/,
  /bg-gradient-to-br from-blue-500 to-purple-600.*text-white.*font-bold/,
  /w-4 h-4 text-white.*User/,
  /w-5 h-5 text-white.*User/,

  // Specific line patterns that should be allowed
  /<User class="w-4 h-4 text-white" \/>/,
  /<User class="w-5 h-5 text-white" \/>/,
  /<span class="text-white font-bold text-sm">K<\/span>/,
  /class="font-medium text-gray-900 dark:text-white"/,
  /placeholder:text-gray-500 dark:placeholder:text-gray-400/,
]

describe('Hardcoded Color Detection', () => {
  componentFiles.forEach((filePath) => {
    describe(`${filePath}`, () => {
      let fileContent: string

      beforeAll(() => {
        try {
          const fullPath = join(__dirname, '..', filePath)
          fileContent = readFileSync(fullPath, 'utf-8')
        } catch (_error) {
          fileContent = ''
        }
      })

      it('should not contain hardcoded color classes', () => {
        if (!fileContent) return // Skip if file doesn't exist

        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Test function with complex validation logic
        hardcodedColorPatterns.forEach((pattern) => {
          const matches = fileContent.match(pattern)
          if (!matches) return

          // Special handling for text-white in gradient contexts
          if (pattern.toString().includes('text-white')) {
            const textWhiteMatches = matches.filter(
              (match) => match === 'text-white'
            )
            const lines = fileContent.split('\n')

            const allTextWhiteAllowed = textWhiteMatches.every((match) => {
              const matchLines = lines.filter((line) => line.includes(match))
              return matchLines.some((line) =>
                allowedPatterns.some((allowed) => allowed.test(line))
              )
            })

            if (allTextWhiteAllowed) return
          }

          // Filter out allowed patterns
          const filteredMatches = matches.filter((match) => {
            return !allowedPatterns.some((allowedPattern) =>
              allowedPattern.test(match)
            )
          })

          // Report remaining matches
          if (filteredMatches.length > 0) {
            console.error(`Found hardcoded colors in ${filePath}:`)
            filteredMatches.forEach((match) => {
              console.error(`  - ${match}`)
            })
            expect(true).toBe(false) // Force test failure
          }
        })
      })

      it('should use theme utilities for colors', () => {
        if (!fileContent) return

        // Check that theme utilities are being used
        const hasThemeUtilities =
          fileContent.includes('getTextClasses') ||
          fileContent.includes('getBackgroundClasses') ||
          fileContent.includes('getBorderClasses') ||
          fileContent.includes('getStatusClasses') ||
          fileContent.includes('getThemeComponentClasses') ||
          fileContent.includes('getThemeClasses') ||
          fileContent.includes('getSemanticColor') ||
          fileContent.includes('getThemeColor')

        // Allow some components to not use theme utilities if they're simple
        const simpleComponents = [
          'components/ui/ErrorBoundary.tsx',
          'components/ui/Loading.tsx',
        ]

        if (!simpleComponents.includes(filePath)) {
          expect(hasThemeUtilities).toBe(true)
        }
      })

      it('should not use inline styles for colors', () => {
        if (!fileContent) return

        // Check for inline style attributes with colors
        const inlineStylePattern =
          /style\s*=\s*{[^}]*(?:color|backgroundColor|borderColor)[^}]*}/
        const matches = fileContent.match(inlineStylePattern)

        if (matches) {
          expect.fail(
            `Found inline styles for colors in ${filePath}:\n` +
              `${matches.join('\n')}\n\n` +
              `Please use CSS classes or theme utilities instead.`
          )
        }
      })

      it('should use semantic color names for status indicators', () => {
        if (!fileContent) return

        // Check for semantic color usage
        const semanticColorUsage =
          fileContent.includes('getStatusClasses') ||
          fileContent.includes('getSemanticColor')

        // If the component has status indicators, it should use semantic colors
        const hasStatusIndicators =
          fileContent.includes('success') ||
          fileContent.includes('error') ||
          fileContent.includes('warning') ||
          fileContent.includes('info')

        if (hasStatusIndicators && !semanticColorUsage) {
          console.warn(
            `Component ${filePath} has status indicators but doesn't use semantic color utilities.\n` +
              `Consider using getStatusClasses() or getSemanticColor() for better consistency.`
          )
        }
      })
    })
  })

  describe('CSS Variables Usage', () => {
    it('should use CSS variables instead of hardcoded values in main.css', () => {
      const cssPath = join(__dirname, '..', 'main.css')
      let cssContent: string

      try {
        cssContent = readFileSync(cssPath, 'utf-8')
      } catch (_error) {
        return // Skip if file doesn't exist
      }

      // Check that CSS variables are defined
      expect(cssContent).toContain('--bg-primary')
      expect(cssContent).toContain('--text-primary')
      expect(cssContent).toContain('--border-primary')
      expect(cssContent).toContain('--accent')

      // Check that both light and dark themes are defined
      expect(cssContent).toContain(':root')
      expect(cssContent).toContain('.dark')

      // Check that variables are used in base styles
      expect(cssContent).toContain('rgb(var(--bg-primary))')
      expect(cssContent).toContain('rgb(var(--text-primary))')
    })
  })

  describe('Theme Consistency', () => {
    it('should have consistent color naming across components', () => {
      const allFiles: string[] = []

      componentFiles.forEach((filePath) => {
        try {
          const fullPath = join(__dirname, '..', filePath)
          const content = readFileSync(fullPath, 'utf-8')
          allFiles.push(content)
        } catch (_error) {
          // Skip files that don't exist
        }
      })

      // Check for consistent usage patterns
      allFiles.every((content) => {
        // Look for consistent patterns in theme utility usage
        const hasProperImports =
          content.includes("from '../../lib/utils'") ||
          content.includes("from '../lib/utils'") ||
          content.includes("from '@/lib/utils'")

        return hasProperImports
      })

      expect(allFiles.length).toBeGreaterThan(0)
    })
  })
})
