import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@solidjs/testing-library'
import { ThemeProvider, useTheme } from '../contexts/ThemeContext'
import { ThemeErrorBoundary } from '../components/ui/ThemeErrorBoundary'

// Test component that uses theme and can simulate errors
function ThemeUserComponent() {
  const theme = useTheme()

  return (
    <div>
      <div data-testid="current-theme">{theme.state.effectiveTheme}</div>
      <div data-testid="has-error">{theme.error ? 'true' : 'false'}</div>
      <Show when={theme.error}>
        <div data-testid="error-message">{theme.error.message}</div>
      </Show>
      <button
        type="button"
        data-testid="set-theme-btn"
        onClick={() => theme.setTheme('dark')}
      >
        Set Dark Theme
      </button>
      <button
        type="button"
        data-testid="clear-error-btn"
        onClick={theme.clearError}
      >
        Clear Error
      </button>
    </div>
  )
}

describe('Theme Error Integration', () => {
  beforeEach(() => {
    // Mock localStorage to throw errors
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage unavailable')
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    })

    // Reset document classes
    document.documentElement.classList.remove('light', 'dark')

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('should handle theme switching errors gracefully', async () => {
    render(() => (
      <ThemeErrorBoundary>
        <ThemeProvider>
          <ThemeUserComponent />
        </ThemeProvider>
      </ThemeErrorBoundary>
    ))

    // Initially no error
    expect(screen.getByTestId('has-error')).toHaveTextContent('false')

    // Try to set theme (should fail due to localStorage error)
    const setThemeBtn = screen.getByTestId('set-theme-btn')
    fireEvent.click(setThemeBtn)

    // Theme should still change in UI despite storage error
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    })

    // Error should be set in context
    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
    })

    // Error message should be available
    expect(screen.getByTestId('error-message')).toBeInTheDocument()
  })

  it('should clear errors when clearError is called', async () => {
    render(() => (
      <ThemeErrorBoundary>
        <ThemeProvider>
          <ThemeUserComponent />
        </ThemeProvider>
      </ThemeErrorBoundary>
    ))

    // Trigger an error
    const setThemeBtn = screen.getByTestId('set-theme-btn')
    fireEvent.click(setThemeBtn)

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
    })

    // Clear the error
    const clearErrorBtn = screen.getByTestId('clear-error-btn')
    fireEvent.click(clearErrorBtn)

    // Error should be cleared
    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('false')
    })

    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })

  it('should continue working after errors are cleared', async () => {
    render(() => (
      <ThemeErrorBoundary>
        <ThemeProvider>
          <ThemeUserComponent />
        </ThemeProvider>
      </ThemeErrorBoundary>
    ))

    // Trigger an error
    const setThemeBtn = screen.getByTestId('set-theme-btn')
    fireEvent.click(setThemeBtn)

    // Wait for error and theme change
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
    })

    // Clear the error
    const clearErrorBtn = screen.getByTestId('clear-error-btn')
    fireEvent.click(clearErrorBtn)

    // Wait for error to clear
    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('false')
    })

    // Try to set theme again (should still work)
    fireEvent.click(setThemeBtn)

    // Theme should still change (though it might be the same)
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    })

    // Error might appear again due to storage failure, but app should still work
    // The key point is that the app doesn't crash
  })

  it('should wrap theme switching in error boundary', async () => {
    render(() => (
      <ThemeErrorBoundary>
        <ThemeProvider>
          <ThemeUserComponent />
        </ThemeProvider>
      </ThemeErrorBoundary>
    ))

    // The component should render without crashing
    expect(screen.getByTestId('current-theme')).toBeInTheDocument()
    expect(screen.getByTestId('has-error')).toBeInTheDocument()

    // Theme switching should work even if storage fails
    const setThemeBtn = screen.getByTestId('set-theme-btn')
    fireEvent.click(setThemeBtn)

    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    })

    // The error boundary should catch any unexpected errors
    // and the app should remain functional
    expect(screen.getByTestId('current-theme')).toBeInTheDocument()
  })
})
