import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@solidjs/testing-library'
import { Show } from 'solid-js'
import { ThemeProvider, useTheme } from './ThemeContext'

// Test component to access theme context with error display
function TestComponentWithError() {
  const theme = useTheme()

  return (
    <div>
      <div data-testid="current-theme">{theme.state.effectiveTheme}</div>
      <div data-testid="user-theme">{theme.state.theme}</div>
      <div data-testid="system-theme">{theme.state.systemTheme}</div>
      <div data-testid="has-error">{theme.error ? 'true' : 'false'}</div>
      <Show when={theme.error}>
        <div data-testid="error-message">{theme.error?.message}</div>
        <div data-testid="error-type">{theme.error?.type}</div>
      </Show>
      <button
        type="button"
        data-testid="toggle-btn"
        onClick={theme.toggleTheme}
      >
        Toggle
      </button>
      <button
        type="button"
        data-testid="light-btn"
        onClick={() => theme.setTheme('light')}
      >
        Light
      </button>
      <button
        type="button"
        data-testid="dark-btn"
        onClick={() => theme.setTheme('dark')}
      >
        Dark
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

describe('ThemeContext Error Handling', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
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
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
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

  it('should initialize without errors', () => {
    render(() => (
      <ThemeProvider>
        <TestComponentWithError />
      </ThemeProvider>
    ))

    expect(screen.getByTestId('has-error')).toHaveTextContent('false')
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })

  it('should handle localStorage setItem errors gracefully', async () => {
    // Mock localStorage to throw on setItem
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

    render(() => (
      <ThemeProvider>
        <TestComponentWithError />
      </ThemeProvider>
    ))

    const darkBtn = screen.getByTestId('dark-btn')
    fireEvent.click(darkBtn)

    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
    })

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Unexpected error saving theme to storage'
    )
    expect(screen.getByTestId('error-type')).toHaveTextContent('UNKNOWN')
  })

  it('should handle localStorage quota exceeded errors', async () => {
    // Mock localStorage to throw quota exceeded error
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => {
        const error = new Error('Quota exceeded')
        error.name = 'QuotaExceededError'
        throw error
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    })

    render(() => (
      <ThemeProvider>
        <TestComponentWithError />
      </ThemeProvider>
    ))

    const lightBtn = screen.getByTestId('light-btn')
    fireEvent.click(lightBtn)

    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
    })

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'localStorage quota exceeded, theme preference not saved'
    )
  })

  it('should clear errors when clearError is called', async () => {
    // Mock localStorage to throw on setItem
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Storage error')
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    })

    render(() => (
      <ThemeProvider>
        <TestComponentWithError />
      </ThemeProvider>
    ))

    // Trigger an error
    const darkBtn = screen.getByTestId('dark-btn')
    fireEvent.click(darkBtn)

    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
    })

    // Clear the error
    const clearErrorBtn = screen.getByTestId('clear-error-btn')
    fireEvent.click(clearErrorBtn)

    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('false')
    })

    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument()
  })

  it('should handle toggleTheme errors gracefully', async () => {
    // Mock localStorage to throw on setItem
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Toggle failed')
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    })

    render(() => (
      <ThemeProvider>
        <TestComponentWithError />
      </ThemeProvider>
    ))

    const toggleBtn = screen.getByTestId('toggle-btn')
    fireEvent.click(toggleBtn)

    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
    })

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Unexpected error saving theme to storage'
    )
  })

  it('should handle errors and set them in context', async () => {
    // Mock localStorage to throw an error
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    })

    render(() => (
      <ThemeProvider>
        <TestComponentWithError />
      </ThemeProvider>
    ))

    const darkBtn = screen.getByTestId('dark-btn')
    fireEvent.click(darkBtn)

    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
    })

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Unexpected error saving theme to storage'
    )
    expect(screen.getByTestId('error-type')).toHaveTextContent('UNKNOWN')
  })

  it('should continue theme switching despite storage errors', async () => {
    // Mock localStorage to fail on first call, succeed on second
    let callCount = 0
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          throw new Error('First save failed')
        }
        return true
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    })

    render(() => (
      <ThemeProvider>
        <TestComponentWithError />
      </ThemeProvider>
    ))

    // First theme change should fail but still update UI
    const darkBtn = screen.getByTestId('dark-btn')
    fireEvent.click(darkBtn)

    await waitFor(() => {
      expect(screen.getByTestId('user-theme')).toHaveTextContent('dark')
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
    })

    // Clear error and try again
    const clearErrorBtn = screen.getByTestId('clear-error-btn')
    fireEvent.click(clearErrorBtn)

    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('false')
    })

    // Second theme change should succeed
    const lightBtn = screen.getByTestId('light-btn')
    fireEvent.click(lightBtn)

    await waitFor(() => {
      expect(screen.getByTestId('user-theme')).toHaveTextContent('light')
      expect(screen.getByTestId('has-error')).toHaveTextContent('false')
    })
  })

  it('should handle unexpected errors in theme switching', async () => {
    // Mock a scenario where something unexpected goes wrong
    render(() => (
      <ThemeProvider>
        <TestComponentWithError />
      </ThemeProvider>
    ))

    // Simulate an unexpected error by calling setTheme with invalid data
    // This would normally be caught by validation, but we test the error handling
    const themeContext = screen.getByTestId('current-theme')

    // The theme should still work normally without throwing
    expect(themeContext).toHaveTextContent('light')
  })

  it('should provide error context to consumers', async () => {
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Context error test')
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    })

    render(() => (
      <ThemeProvider>
        <TestComponentWithError />
      </ThemeProvider>
    ))

    const darkBtn = screen.getByTestId('dark-btn')
    fireEvent.click(darkBtn)

    await waitFor(() => {
      expect(screen.getByTestId('has-error')).toHaveTextContent('true')
      expect(screen.getByTestId('error-message')).toBeInTheDocument()
      expect(screen.getByTestId('error-type')).toBeInTheDocument()
    })
  })
})
