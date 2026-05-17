import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { createSignal } from 'solid-js'
import type { Component } from 'solid-js'

// Mock the theme utilities
vi.mock('../../lib/theme-classes', () => ({
  getBackgroundClasses: vi.fn(),
  getTextClasses: vi.fn(),
  getBorderClasses: vi.fn(),
}))

vi.mock('../../lib/theme-helpers', () => ({
  getStatusClasses: vi.fn(),
}))

vi.mock('../../lib/error-utils', () => ({
  normalizeError: vi.fn(),
  sanitizeErrorMessage: vi.fn(),
  safeGetThemeClasses: vi.fn(),
  getErrorCategoryInfo: vi.fn(),
  ErrorCategory: {
    NETWORK: 'NETWORK',
    RENDERING: 'RENDERING',
    USER_INPUT: 'USER_INPUT',
    PERMISSION: 'PERMISSION',
    MOTION: 'MOTION',
    UNKNOWN: 'UNKNOWN',
  },
}))

describe('ErrorBoundary Theme Failure Integration Tests', () => {
  let themeClasses: any
  let themeHelpers: any
  let errorUtils: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    cleanup()

    // Get mocked modules
    themeClasses = await import('../../lib/theme-classes')
    themeHelpers = await import('../../lib/theme-helpers')
    errorUtils = await import('../../lib/error-utils')

    // Set up default successful mock implementations
    vi.mocked(themeClasses.getBackgroundClasses).mockReturnValue(
      'bg-background'
    )
    vi.mocked(themeClasses.getTextClasses).mockReturnValue('text-foreground')
    vi.mocked(themeClasses.getBorderClasses).mockReturnValue('border-border')
    vi.mocked(themeHelpers.getStatusClasses).mockReturnValue('text-red-600')
    vi.mocked(errorUtils.safeGetThemeClasses).mockImplementation(
      (getter: any, fallback: string) => {
        try {
          return getter()
        } catch {
          return fallback
        }
      }
    )
    vi.mocked(errorUtils.getErrorCategoryInfo).mockReturnValue({
      category: 'UNKNOWN' as any,
      title: 'Unexpected Error',
      description:
        'An unexpected error occurred while processing your request.',
      recoverySuggestions: [
        'Try refreshing the page',
        'Check your internet connection',
      ],
      icon: 'alert-triangle',
      severity: 'medium' as any,
    })
    vi.mocked(errorUtils.normalizeError).mockImplementation((error: any) => {
      if (error instanceof Error) return error
      if (typeof error === 'string') return new Error(error)
      return new Error('Unknown error occurred')
    })
    vi.mocked(errorUtils.sanitizeErrorMessage).mockImplementation(
      (msg: any) => msg || ''
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    cleanup()
  })

  describe('Theme Helper Function Failures', () => {
    it('should handle getBackgroundClasses throwing an error', () => {
      vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(() => {
        throw new Error('Theme background classes failed')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary with fallback classes
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Should have fallback background class from safeGetThemeClasses
      const mainContainer = screen.getByText('Unexpected Error').closest('div')
        ?.parentElement?.parentElement
      expect(mainContainer?.className).toContain('bg-gray-50') // fallback class
    })

    it('should handle getTextClasses throwing an error', () => {
      vi.mocked(themeClasses.getTextClasses).mockImplementation(() => {
        throw new Error('Theme text classes failed')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Should have fallback text class from safeGetThemeClasses
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading.className).toContain('text-gray-900') // fallback class
    })

    it('should handle getBorderClasses throwing an error', () => {
      vi.mocked(themeClasses.getBorderClasses).mockImplementation(() => {
        throw new Error('Theme border classes failed')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Should have fallback border class from safeGetThemeClasses
      const cardContainer = screen
        .getByText('Unexpected Error')
        .closest('div')?.parentElement
      expect(cardContainer?.className).toContain('border-gray-200') // fallback class
    })

    it('should handle getStatusClasses throwing an error', () => {
      vi.mocked(themeHelpers.getStatusClasses).mockImplementation(() => {
        throw new Error('Theme status classes failed')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Should have fallback status class from safeGetThemeClasses
      const iconContainer = screen
        .getByText('Unexpected Error')
        .closest('div')
        ?.querySelector('[class*="p-2"]')
      expect(iconContainer?.className).toContain('bg-red-100') // fallback class
    })

    it('should handle multiple theme helper functions failing simultaneously', () => {
      vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(() => {
        throw new Error('Background classes failed')
      })
      vi.mocked(themeClasses.getTextClasses).mockImplementation(() => {
        throw new Error('Text classes failed')
      })
      vi.mocked(themeClasses.getBorderClasses).mockImplementation(() => {
        throw new Error('Border classes failed')
      })
      vi.mocked(themeHelpers.getStatusClasses).mockImplementation(() => {
        throw new Error('Status classes failed')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary with all fallback classes
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Should have fallback classes applied
      const mainContainer = screen.getByText('Unexpected Error').closest('div')
        ?.parentElement?.parentElement
      expect(mainContainer?.className).toContain('bg-gray-50') // fallback background

      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading.className).toContain('text-gray-900') // fallback text

      const cardContainer = screen
        .getByText('Unexpected Error')
        .closest('div')?.parentElement
      expect(cardContainer?.className).toContain('border-gray-200') // fallback border
    })

    it('should handle theme helpers returning undefined', () => {
      vi.mocked(themeClasses.getBackgroundClasses).mockReturnValue(undefined)
      vi.mocked(themeClasses.getTextClasses).mockReturnValue(undefined)
      vi.mocked(themeClasses.getBorderClasses).mockReturnValue(undefined)
      vi.mocked(themeHelpers.getStatusClasses).mockReturnValue(undefined)

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Should handle undefined values gracefully
      expect(document.body).toBeDefined()
    })

    it('should handle theme helpers returning null', () => {
      vi.mocked(themeClasses.getBackgroundClasses).mockReturnValue(null)
      vi.mocked(themeClasses.getTextClasses).mockReturnValue(null)
      vi.mocked(themeClasses.getBorderClasses).mockReturnValue(null)
      vi.mocked(themeHelpers.getStatusClasses).mockReturnValue(null)

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Should handle null values gracefully
      expect(document.body).toBeDefined()
    })

    it('should handle theme helpers throwing different types of errors', () => {
      const testCases = [
        { error: new Error('Standard error'), name: 'Error' },
        { error: new TypeError('Type error'), name: 'TypeError' },
        {
          error: new ReferenceError('Reference error'),
          name: 'ReferenceError',
        },
        { error: new RangeError('Range error'), name: 'RangeError' },
        { error: 'String error', name: 'String' },
        { error: null, name: 'null' },
        { error: undefined, name: 'undefined' },
      ]

      testCases.forEach(({ error, name }) => {
        cleanup()

        vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(() => {
          throw error
        })

        const ThrowErrorComponent: Component = () => {
          throw new Error(`Test with ${name} theme error`)
        }

        expect(() => {
          render(() => (
            <ErrorBoundary>
              <ThrowErrorComponent />
            </ErrorBoundary>
          ))
        }).not.toThrow()

        // Should still render the error boundary
        expect(screen.getByText('Unexpected Error')).toBeDefined()
      })
    })
  })

  describe('Error Utility Function Failures', () => {
    it('should handle getErrorCategoryInfo throwing an error', () => {
      vi.mocked(errorUtils.getErrorCategoryInfo).mockImplementation(() => {
        throw new Error('Error categorization failed')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary with default error info
      expect(screen.getByText('Unexpected Error')).toBeDefined()
    })

    it('should handle normalizeError throwing an error', () => {
      vi.mocked(errorUtils.normalizeError).mockImplementation(() => {
        throw new Error('Error normalization failed')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary
      expect(screen.getByText('Unexpected Error')).toBeDefined()
    })

    it('should handle sanitizeErrorMessage throwing an error', () => {
      vi.mocked(errorUtils.sanitizeErrorMessage).mockImplementation(() => {
        throw new Error('Message sanitization failed')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary
      expect(screen.getByText('Unexpected Error')).toBeDefined()
    })

    it('should handle safeGetThemeClasses getter throwing an error', () => {
      // Make the getter function throw, not safeGetThemeClasses itself
      vi.mocked(themeHelpers.getStatusClasses).mockImplementation(() => {
        throw new Error('Theme classes getter failed')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still render the error boundary with fallback classes
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Should have fallback status class from safeGetThemeClasses
      const iconElement = screen
        .getByText('Unexpected Error')
        .closest('div')
        ?.querySelector('svg')

      // For SVG elements, we need to check className.baseVal or use classList
      expect(iconElement?.classList.contains('text-red-600')).toBe(true) // fallback class on icon
    })
  })

  describe('Theme Failures During Error Display', () => {
    it('should handle theme failures when showing error details', () => {
      vi.stubEnv('DEV', true)

      vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(() => {
        throw new Error('Background classes failed in details')
      })
      vi.mocked(themeHelpers.getStatusClasses).mockImplementation(() => {
        throw new Error('Status classes failed in details')
      })

      const error = new Error('Test error with details')
      error.stack =
        'Error: Test error with details\n    at Component (/path/to/file.js:10:5)'

      const ThrowErrorComponent: Component = () => {
        throw error
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should show error details button
      expect(screen.getByText('Error Details')).toBeDefined()

      // Click to expand details
      const detailsButton = screen.getByRole('button', {
        name: /Error Details/,
      })
      fireEvent.click(detailsButton)

      // Should still show details even with theme failures
      expect(screen.getByText(/Test error with details/)).toBeDefined()

      vi.unstubAllEnvs()
    })

    it('should handle theme failures during retry attempts', () => {
      let attemptCount = 0
      const shouldThrow = true

      const ConditionalErrorComponent: Component = () => {
        attemptCount++
        if (shouldThrow) {
          // Make theme helpers fail on retry
          if (attemptCount > 1) {
            vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(
              () => {
                throw new Error('Theme failed on retry')
              }
            )
          }
          throw new Error(`Error attempt ${attemptCount}`)
        }
        return <div data-testid="recovered-content">Recovered</div>
      }

      render(() => (
        <ErrorBoundary autoRetry={true} autoRetryDelay={100}>
          <ConditionalErrorComponent />
        </ErrorBoundary>
      ))

      // Should show error initially
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Click retry button
      const resetButton = screen.getByText('Try Again')
      fireEvent.click(resetButton)

      // Should still show error boundary even with theme failures on retry
      expect(screen.getByText('Unexpected Error')).toBeDefined()
    })

    it('should handle theme failures with custom fallback', () => {
      vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(() => {
        throw new Error('Theme failed in custom fallback')
      })

      const customFallback = (error: Error, reset: () => void) => (
        <div data-testid="custom-fallback">
          <h2>Custom Error: {error.message}</h2>
          <button type="button" onClick={reset}>
            Custom Reset
          </button>
        </div>
      )

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary fallback={customFallback}>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should show custom fallback even with theme failures
      expect(screen.getByTestId('custom-fallback')).toBeDefined()
      expect(screen.getByText('Custom Error: Test error')).toBeDefined()
    })
  })

  describe('Environment-Specific Theme Failures', () => {
    it('should handle theme failures in development mode', () => {
      vi.stubEnv('DEV', true)

      vi.mocked(themeClasses.getTextClasses).mockImplementation(() => {
        throw new Error('Dev mode theme failure')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Dev mode error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still show error details in dev mode
      expect(screen.getByText('Error Details')).toBeDefined()
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      vi.unstubAllEnvs()
    })

    it('should handle theme failures in production mode', () => {
      vi.stubEnv('DEV', false)

      vi.mocked(themeClasses.getTextClasses).mockImplementation(() => {
        throw new Error('Production mode theme failure')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Production mode error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should not show error details in production mode
      expect(screen.queryByText('Error Details')).toBeNull()
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      vi.unstubAllEnvs()
    })

    it('should handle theme failures with auto-retry in different environments', () => {
      vi.stubEnv('DEV', true)

      vi.mocked(themeHelpers.getStatusClasses).mockImplementation(() => {
        throw new Error('Auto-retry theme failure')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Auto-retry error')
      }

      render(() => (
        <ErrorBoundary autoRetry={true} autoRetryDelay={100}>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should show error and retry countdown even with theme failures
      expect(screen.getByText('Unexpected Error')).toBeDefined()
      expect(screen.getByText(/Next retry in \ds/)).toBeDefined()

      vi.unstubAllEnvs()
    })
  })

  describe('Recovery from Theme Failures', () => {
    it('should allow recovery when theme helpers start working again', () => {
      let shouldFailTheme = true

      vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(() => {
        if (shouldFailTheme) {
          throw new Error('Theme temporarily failed')
        }
        return 'bg-background'
      })

      let shouldThrowError = true

      const ConditionalErrorComponent: Component = () => {
        if (shouldThrowError) {
          throw new Error('Test error')
        }
        return <div data-testid="recovered-content">Recovered</div>
      }

      render(() => (
        <ErrorBoundary>
          <ConditionalErrorComponent />
        </ErrorBoundary>
      ))

      // Should show error with fallback classes
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Fix theme and component error
      shouldFailTheme = false
      shouldThrowError = false

      // Click reset
      const resetButton = screen.getByText('Try Again')
      fireEvent.click(resetButton)

      // Should recover successfully
      expect(screen.getByTestId('recovered-content')).toBeDefined()
      expect(screen.getByText('Recovered')).toBeDefined()
    })

    it('should maintain error boundary functionality despite persistent theme failures', () => {
      // Make theme helpers consistently fail
      vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(() => {
        throw new Error('Persistent theme failure')
      })
      vi.mocked(themeClasses.getTextClasses).mockImplementation(() => {
        throw new Error('Persistent theme failure')
      })

      let shouldThrow = true

      const ConditionalErrorComponent: Component = () => {
        if (shouldThrow) {
          throw new Error('Persistent error')
        }
        return <div data-testid="recovered-content">Recovered</div>
      }

      render(() => (
        <ErrorBoundary>
          <ConditionalErrorComponent />
        </ErrorBoundary>
      ))

      // Should show error with fallback classes
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      // Try multiple resets
      const resetButton = screen.getByText('Try Again')

      for (let i = 0; i < 3; i++) {
        fireEvent.click(resetButton)
        expect(screen.getByText('Unexpected Error')).toBeDefined()
      }

      // Finally fix the component error and render again
      shouldThrow = false
      cleanup()

      render(() => (
        <ErrorBoundary>
          <ConditionalErrorComponent />
        </ErrorBoundary>
      ))

      // Should recover despite theme failures
      expect(screen.getByTestId('recovered-content')).toBeDefined()
      expect(screen.getByText('Recovered')).toBeDefined()
    })

    it('should handle theme failures during error handler callback', () => {
      const mockOnError = vi.fn()

      vi.mocked(themeClasses.getTextClasses).mockImplementation(() => {
        throw new Error('Theme failed during error handling')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Error during theme failure')
      }

      render(() => (
        <ErrorBoundary onError={mockOnError}>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should still call error handler despite theme failures
      expect(mockOnError).toHaveBeenCalled()
      expect(screen.getByText('Unexpected Error')).toBeDefined()
    })
  })

  describe('Edge Cases and Stress Tests', () => {
    it('should handle rapid theme failure and recovery cycles', () => {
      let callCount = 0

      vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(() => {
        callCount++
        if (callCount % 2 === 0) {
          throw new Error('Alternating theme failure')
        }
        return 'bg-background'
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Rapid cycle error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should handle alternating theme success/failure
      expect(screen.getByText('Unexpected Error')).toBeDefined()

      const resetButton = screen.getByText('Try Again')

      // Try multiple rapid resets
      for (let i = 0; i < 5; i++) {
        fireEvent.click(resetButton)
        expect(screen.getByText('Unexpected Error')).toBeDefined()
      }
    })

    it('should handle theme failures with complex error objects', () => {
      vi.mocked(themeClasses.getBorderClasses).mockImplementation(() => {
        throw new Error('Complex error theme failure')
      })

      const complexError = {
        message: 'Complex error message',
        code: 'COMPLEX_ERROR',
        status: 500,
        details: { nested: 'error data' },
      }

      const ThrowComplexErrorComponent: Component = () => {
        throw complexError
      }

      render(() => (
        <ErrorBoundary>
          <ThrowComplexErrorComponent />
        </ErrorBoundary>
      ))

      // Should handle complex errors despite theme failures
      expect(screen.getByText('Unexpected Error')).toBeDefined()
    })

    it('should handle theme failures with memory pressure simulation', () => {
      // Simulate memory pressure by making theme helpers expensive
      vi.mocked(themeClasses.getBackgroundClasses).mockImplementation(() => {
        // Simulate expensive operation
        const largeArray = new Array(10000).fill('theme-class')
        if (Math.random() < 0.5) {
          throw new Error('Memory pressure theme failure')
        }
        return largeArray.join(' ')
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Memory pressure error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Should handle memory pressure scenarios
      expect(screen.getByText('Unexpected Error')).toBeDefined()
    })
  })
})
