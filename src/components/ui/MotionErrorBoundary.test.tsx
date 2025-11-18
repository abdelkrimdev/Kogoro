import { render, screen, fireEvent } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MotionErrorBoundary } from './MotionErrorBoundary'
import type { Component } from 'solid-js'

// Mock the motion hooks and utilities
vi.mock('../../lib/motion', () => ({
  isMotionEnabled: vi.fn(() => true),
}))

vi.mock('../../hooks/useMotionAnimations', () => ({
  useReducedMotion: () => ({
    shouldAnimate: () => false,
    prefersReduced: () => false,
  }),
}))

// Mock console methods
const originalConsoleError = console.error
const originalConsoleInfo = console.info

describe('MotionErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    console.error = vi.fn()
    console.info = vi.fn()

    // Mock DEV environment
    vi.stubGlobal('import.meta', {
      env: { DEV: true },
    })
  })

  afterEach(() => {
    console.error = originalConsoleError
    console.info = originalConsoleInfo
    vi.unstubAllGlobals()
  })

  describe('Basic Error Handling', () => {
    it('should render children when there is no error', () => {
      const ChildComponent = () => (
        <div data-testid="motion-child">No Error</div>
      )

      render(() => (
        <MotionErrorBoundary>
          <ChildComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.getByTestId('motion-child')).toBeInTheDocument()
      expect(screen.getByText('No Error')).toBeInTheDocument()
    })

    it('should catch and display motion errors', () => {
      const ThrowMotionErrorComponent: Component = () => {
        throw new Error('motion animation failed')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowMotionErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.getByText('Animation Error')).toBeInTheDocument()
      expect(screen.getByText(/animation failed to render/)).toBeInTheDocument()
    })

    it('should catch and display non-motion errors', () => {
      const ThrowGeneralErrorComponent: Component = () => {
        throw new Error('General component error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowGeneralErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.getByText('Component Error')).toBeInTheDocument()
      expect(screen.getByText(/unexpected error occurred/)).toBeInTheDocument()
    })

    it('should use custom fallback when provided', () => {
      const customFallback = (
        error: Error,
        reset: () => void,
        retry: () => void
      ) => (
        <div data-testid="custom-motion-fallback">
          <h2>Custom Motion Error</h2>
          <p>{error.message}</p>
          <button type="button" onClick={reset}>
            Custom Reset
          </button>
          <button type="button" onClick={retry}>
            Custom Retry
          </button>
        </div>
      )

      const ThrowErrorComponent: Component = () => {
        throw new Error('Custom motion error')
      }

      render(() => (
        <MotionErrorBoundary fallback={customFallback}>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.getByTestId('custom-motion-fallback')).toBeInTheDocument()
      expect(screen.getByText('Custom Motion Error')).toBeInTheDocument()
      expect(screen.getByText('Custom motion error')).toBeInTheDocument()
    })
  })

  describe('Error Callback', () => {
    it('should call onError callback when error occurs', () => {
      const onError = vi.fn()
      const error = new Error('Test error')

      const ThrowErrorComponent: Component = () => {
        throw error
      }

      render(() => (
        <MotionErrorBoundary onError={onError}>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(onError).toHaveBeenCalledWith(error, { componentStack: '' })
    })

    it('should log motion-specific errors to console', () => {
      const ThrowMotionErrorComponent: Component = () => {
        throw new Error('motion animation timeout')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowMotionErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(console.error).toHaveBeenCalledWith(
        'Motion Error:',
        expect.objectContaining({
          error: 'motion animation timeout',
          motionState: expect.objectContaining({
            enabled: true,
            reducedMotion: false,
          }),
          timestamp: expect.any(Number),
        })
      )
    })
  })

  describe('Retry Functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should provide retry functionality', () => {
      let shouldThrow = true

      const ConditionalErrorComponent: Component = () => {
        if (shouldThrow) {
          throw new Error('Retry test error')
        }
        return <div data-testid="recovered-motion-content">Recovered</div>
      }

      render(() => (
        <MotionErrorBoundary maxRetries={3}>
          <ConditionalErrorComponent />
        </MotionErrorBoundary>
      ))

      // Should show error initially
      expect(screen.getByText('Component Error')).toBeInTheDocument()

      // Click retry button
      const retryButton = screen.getByText('Retry')
      shouldThrow = false
      fireEvent.click(retryButton)

      // Should show retrying state
      expect(screen.getByText('Retrying...')).toBeInTheDocument()

      // Advance timers
      vi.advanceTimersByTime(1100)

      // Should show recovered content
      expect(screen.getByTestId('recovered-motion-content')).toBeInTheDocument()
    })

    it('should respect maxRetries limit', () => {
      let throwCount = 0

      const CountingErrorComponent: Component = () => {
        throwCount++
        throw new Error(`Error ${throwCount}`)
      }

      render(() => (
        <MotionErrorBoundary maxRetries={2}>
          <CountingErrorComponent />
        </MotionErrorBoundary>
      ))

      // First retry
      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)
      vi.advanceTimersByTime(1100)

      // Second retry
      fireEvent.click(retryButton)
      vi.advanceTimersByTime(1100)

      // Should not show retry button after max retries
      expect(screen.queryByText('Retry')).not.toBeInTheDocument()
      expect(screen.getByText('Retry attempt 2 of 2')).toBeInTheDocument()
    })

    it('should show retry attempt count', () => {
      const PersistentErrorComponent: Component = () => {
        throw new Error('Persistent error')
      }

      render(() => (
        <MotionErrorBoundary maxRetries={3}>
          <PersistentErrorComponent />
        </MotionErrorBoundary>
      ))

      // Initial error - no retry count
      expect(screen.queryByText(/Retry attempt/)).not.toBeInTheDocument()

      // First retry
      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)
      vi.advanceTimersByTime(1100)

      expect(screen.getByText('Retry attempt 1 of 3')).toBeInTheDocument()

      // Second retry
      fireEvent.click(retryButton)
      vi.advanceTimersByTime(1100)

      expect(screen.getByText('Retry attempt 2 of 3')).toBeInTheDocument()
    })

    it('should disable retry button during retry', () => {
      const PersistentErrorComponent: Component = () => {
        throw new Error('Persistent error')
      }

      render(() => (
        <MotionErrorBoundary>
          <PersistentErrorComponent />
        </MotionErrorBoundary>
      ))

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      // Should be disabled during retry
      expect(retryButton).toBeDisabled()
      expect(screen.getByText('Retrying...')).toBeInTheDocument()

      // Should be re-enabled after retry completes
      vi.advanceTimersByTime(1100)
      expect(retryButton).not.toBeDisabled()
    })
  })

  describe('Reset Functionality', () => {
    it('should provide reset functionality', () => {
      let shouldThrow = true

      const ConditionalErrorComponent: Component = () => {
        if (shouldThrow) {
          throw new Error('Reset test error')
        }
        return <div data-testid="reset-content">Reset Success</div>
      }

      render(() => (
        <MotionErrorBoundary>
          <ConditionalErrorComponent />
        </MotionErrorBoundary>
      ))

      // Should show error initially
      expect(screen.getByText('Component Error')).toBeInTheDocument()

      // Click reset button
      const resetButton = screen.getByText('Reset')
      shouldThrow = false
      fireEvent.click(resetButton)

      // Should show recovered content
      expect(screen.getByTestId('reset-content')).toBeInTheDocument()
    })
  })

  describe('Motion-Specific Features', () => {
    it('should show motion state information for motion errors', () => {
      const ThrowMotionErrorComponent: Component = () => {
        throw new Error('motion animation failed')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowMotionErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.getByText(/Motion:/)).toBeInTheDocument()
      expect(screen.getByText(/Reduced Motion:/)).toBeInTheDocument()
    })

    it('should not show motion state information for non-motion errors', () => {
      const ThrowGeneralErrorComponent: Component = () => {
        throw new Error('General error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowGeneralErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.queryByText(/Motion:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Reduced Motion:/)).not.toBeInTheDocument()
    })

    it('should show "Try Without Animation" button for motion errors', () => {
      const ThrowMotionErrorComponent: Component = () => {
        throw new Error('motion animation failed')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowMotionErrorComponent />
        </MotionErrorBoundary>
      ))

      const tryWithoutAnimationButton = screen.getByText(
        'Try Without Animation'
      )
      expect(tryWithoutAnimationButton).toBeInTheDocument()

      // Click the button
      fireEvent.click(tryWithoutAnimationButton)
      expect(console.info).toHaveBeenCalledWith(
        'Falling back to non-animated version'
      )
    })

    it('should not show "Try Without Animation" button for non-motion errors', () => {
      const ThrowGeneralErrorComponent: Component = () => {
        throw new Error('General error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowGeneralErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(
        screen.queryByText('Try Without Animation')
      ).not.toBeInTheDocument()
    })

    it('should show correct icon for motion errors', () => {
      const ThrowMotionErrorComponent: Component = () => {
        throw new Error('motion animation failed')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowMotionErrorComponent />
        </MotionErrorBoundary>
      ))

      // Should show Pause icon for motion errors
      const pauseIcon = document.querySelector('svg')
      expect(pauseIcon).toBeInTheDocument()
    })

    it('should show correct icon for non-motion errors', () => {
      const ThrowGeneralErrorComponent: Component = () => {
        throw new Error('General error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowGeneralErrorComponent />
        </MotionErrorBoundary>
      ))

      // Should show TriangleAlert icon for general errors
      const alertIcon = document.querySelector('svg')
      expect(alertIcon).toBeInTheDocument()
    })
  })

  describe('Development Mode Features', () => {
    it('should show error details in development mode', () => {
      const error = new Error('Development error')
      error.stack =
        'Error: Development error\n    at Component (/path/to/file.js:10:5)'

      const ThrowErrorComponent: Component = () => {
        throw error
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.getByText('Error Details')).toBeInTheDocument()
      expect(screen.getByText(/Development error/)).toBeInTheDocument()
    })

    it('should allow expanding and collapsing error details', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Expandable error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      const summary = screen.getByText('Error Details')
      expect(summary).toBeInTheDocument()

      // Click to expand/collapse
      fireEvent.click(summary)
      expect(summary).toBeInTheDocument()
    })
  })

  describe('Production Mode', () => {
    beforeEach(() => {
      vi.stubGlobal('import.meta', {
        env: { DEV: false },
      })
    })

    it('should not show error details in production mode', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Production error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.queryByText('Error Details')).not.toBeInTheDocument()
      expect(screen.queryByText(/Production error/)).not.toBeInTheDocument()
    })
  })

  describe('Configuration Options', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should use custom maxRetries', () => {
      const PersistentErrorComponent: Component = () => {
        throw new Error('Persistent error')
      }

      render(() => (
        <MotionErrorBoundary maxRetries={1}>
          <PersistentErrorComponent />
        </MotionErrorBoundary>
      ))

      // Should allow one retry
      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)
      vi.advanceTimersByTime(1100)

      // Should not allow second retry
      expect(screen.queryByText('Retry')).not.toBeInTheDocument()
      expect(screen.getByText('Retry attempt 1 of 1')).toBeInTheDocument()
    })

    it('should use custom retryDelay', () => {
      const PersistentErrorComponent: Component = () => {
        throw new Error('Persistent error')
      }

      render(() => (
        <MotionErrorBoundary retryDelay={2000}>
          <PersistentErrorComponent />
        </MotionErrorBoundary>
      ))

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      // Should still be retrying after 1 second
      vi.advanceTimersByTime(1000)
      expect(screen.getByText('Retrying...')).toBeInTheDocument()

      // Should complete after 2 seconds
      vi.advanceTimersByTime(1000)
      expect(screen.queryByText('Retrying...')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button types', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      const retryButton = screen.getByText('Retry')
      const resetButton = screen.getByText('Reset')

      expect(retryButton).toHaveAttribute('type', 'button')
      expect(resetButton).toHaveAttribute('type', 'button')
    })

    it('should have proper ARIA attributes', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      // Check for proper heading structure
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toBeInTheDocument()
    })

    it('should disable retry button appropriately', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Test error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      expect(retryButton).toBeDisabled()
      expect(retryButton).toHaveClass(
        'disabled:opacity-50',
        'disabled:cursor-not-allowed'
      )
    })
  })

  describe('Theme Integration', () => {
    it('should apply theme classes correctly', () => {
      const ThrowErrorComponent: Component = () => {
        throw new Error('Theme test error')
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      // Check that theme classes are applied
      const errorContainer = screen.getByText('Component Error').closest('div')
      expect(errorContainer).toBeInTheDocument()

      const mainContainer = document.querySelector('.min-h-\\[100px\\]')
      expect(mainContainer).toHaveClass(
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
        <MotionErrorBoundary>
          <ThrowErrorComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.getByText('Component Error')).toBeInTheDocument()
    })

    it('should handle non-Error objects thrown', () => {
      const ThrowStringComponent: Component = () => {
        throw 'String error'
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowStringComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.getByText('Component Error')).toBeInTheDocument()
    })

    it('should handle null/undefined errors', () => {
      const ThrowNullComponent: Component = () => {
        throw null
      }

      render(() => (
        <MotionErrorBoundary>
          <ThrowNullComponent />
        </MotionErrorBoundary>
      ))

      expect(screen.getByText('Component Error')).toBeInTheDocument()
    })
  })
})
