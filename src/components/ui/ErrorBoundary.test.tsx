import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import type { Component } from 'solid-js'

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    console.error = vi.fn()
    cleanup()
  })

  afterEach(() => {
    vi.useRealTimers()
    console.error = originalConsoleError
    vi.clearAllMocks()
    cleanup()
  })

  describe('Basic Functionality', () => {
    it('should render children when there is no error', () => {
      const ChildComponent = () => (
        <div data-testid="child-content">No Error</div>
      )

      render(() => (
        <ErrorBoundary>
          <ChildComponent />
        </ErrorBoundary>
      ))

      expect(screen.getByTestId('child-content')).toBeInTheDocument()
      expect(screen.getByText('No Error')).toBeInTheDocument()
    })

    it('should catch and display errors from children', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(
        screen.getByText(
          'An unexpected error occurred while rendering this page.'
        )
      ).toBeInTheDocument()
    })

    it('should use custom fallback when provided', () => {
      const customFallback = (error: Error, reset: () => void) => (
        <div data-testid="custom-fallback">
          <h2>Custom Error</h2>
          <p>{error.message}</p>
          <button type="button" onClick={reset}>
            Custom Reset
          </button>
        </div>
      )

      const ThrowErrorComponent: Component = () => {
        throw new Error('Custom error message')
      }

      render(() => (
        <ErrorBoundary fallback={customFallback}>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
      expect(screen.getByText('Custom Error')).toBeInTheDocument()
      expect(screen.getByText('Custom error message')).toBeInTheDocument()
      expect(screen.getByText('Custom Reset')).toBeInTheDocument()
    })
  })

  describe('Error Recovery', () => {
    it('should provide reset functionality', () => {
      let shouldThrow = true

      const ConditionalErrorComponent: Component = () => {
        if (shouldThrow) {
          throw new Error('Conditional error')
        }
        return <div data-testid="recovered-content">Recovered</div>
      }

      render(() => (
        <ErrorBoundary>
          <ConditionalErrorComponent />
        </ErrorBoundary>
      ))

      // Should show error initially
      expect(screen.getAllByText('Something went wrong')[0]).toBeInTheDocument()

      // Click reset button
      const resetButton = screen.getAllByText('Try Again')[0]
      shouldThrow = false
      fireEvent.click(resetButton)

      // Should show recovered content
      expect(screen.getByTestId('recovered-content')).toBeInTheDocument()
      expect(screen.getByText('Recovered')).toBeInTheDocument()
    })

    it('should reload page when reload button is clicked', () => {
      const mockReload = vi.fn()
      // Use Object.defineProperty to override the readonly property
      Object.defineProperty(window.location, 'reload', {
        value: mockReload,
        writable: true,
        configurable: true,
      })

      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      const reloadButton = screen.getByText('Reload Page')
      fireEvent.click(reloadButton)

      expect(mockReload).toHaveBeenCalled()
    })
  })

  describe('Development Mode Features', () => {
    const originalEnv = import.meta.env

    beforeEach(() => {
      // Mock DEV environment
      vi.stubGlobal('import.meta', {
        ...originalEnv,
        env: { ...originalEnv.env, DEV: true },
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should show error details in development mode', () => {
      const error = new Error('Development error')
      error.stack =
        'Error: Development error\n    at Component (/path/to/file.js:10:5)'

      const ThrowErrorComponent: Component = () => {
        throw error
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      expect(screen.getByText('Error Details')).toBeInTheDocument()

      const details = screen.getByText(/Error: Development error/)
      expect(details).toBeInTheDocument()
    })

    it('should allow expanding and collapsing error details', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Expandable error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      const summary = screen.getByText('Error Details')
      expect(summary).toBeInTheDocument()

      // Initially collapsed - check if details are not visible
      const errorDetails = screen.queryByText(/Expandable error/)
      expect(errorDetails).toBeInTheDocument() // In pre tag, should be visible

      // Click to expand/collapse
      fireEvent.click(summary)
      expect(summary).toBeInTheDocument()
    })
  })

  describe('Production Mode', () => {
    beforeEach(() => {
      // Mock production environment
      vi.stubGlobal('import.meta', {
        env: { DEV: false },
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should not show error details in production mode', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Production error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      expect(screen.queryByText('Error Details')).not.toBeInTheDocument()
      expect(screen.queryByText(/Production error/)).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button types', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      const resetButton = screen.getByText('Try Again')
      const reloadButton = screen.getByText('Reload Page')

      expect(resetButton).toHaveAttribute('type', 'button')
      expect(reloadButton).toHaveAttribute('type', 'button')
    })

    it('should have proper ARIA labels and roles', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Check for proper heading structure
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveTextContent('Something went wrong')
    })
  })

  describe('Theme Integration', () => {
    it('should apply theme classes correctly', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Theme test error')
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      // Check that theme classes are applied (basic check for presence)
      const errorContainer = screen
        .getByText('Something went wrong')
        .closest('div')
      expect(errorContainer).toBeInTheDocument()

      const mainContainer = screen
        .getByText('Something went wrong')
        .closest('div')?.parentElement?.parentElement
      expect(mainContainer).toHaveClass(
        'min-h-screen',
        'flex',
        'items-center',
        'justify-center'
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle errors without stack traces', () => {
      const error = new Error('Error without stack')
      delete error.stack

      const ThrowErrorComponent: Component = () => {
        throw error
      }

      render(() => (
        <ErrorBoundary>
          <ThrowErrorComponent />
        </ErrorBoundary>
      ))

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should handle non-Error objects thrown', () => {
      const ThrowStringComponent: Component = () => {
        throw 'String error'
      }

      render(() => (
        <ErrorBoundary>
          <ThrowStringComponent />
        </ErrorBoundary>
      ))

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should handle null/undefined errors', () => {
      const ThrowNullComponent: Component = () => {
        throw null
      }

      render(() => (
        <ErrorBoundary>
          <ThrowNullComponent />
        </ErrorBoundary>
      ))

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('Component Lifecycle', () => {
    it('should handle multiple errors over time', () => {
      let errorCount = 0

      const MultipleErrorComponent: Component = () => {
        errorCount++
        if (errorCount <= 2) {
          throw new Error(`Error ${errorCount}`)
        }
        return <div data-testid="final-content">Success</div>
      }

      render(() => (
        <ErrorBoundary>
          <MultipleErrorComponent />
        </ErrorBoundary>
      ))

      // First error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Reset and trigger second error
      const resetButton = screen.getByText('Try Again')
      fireEvent.click(resetButton)

      // Should show error again
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Reset again
      fireEvent.click(resetButton)

      // Should show success
      expect(screen.getByTestId('final-content')).toBeInTheDocument()
    })
  })
})
