import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@solidjs/testing-library'
import { ThemeProvider, useTheme } from './ThemeContext'
import { UI_CONFIG } from '../lib/config'

// Test component to access theme context
function TestComponent() {
  const theme = useTheme()

  return (
    <div>
      <div data-testid="current-theme">{theme.state.effectiveTheme}</div>
      <div data-testid="user-theme">{theme.state.theme}</div>
      <div data-testid="system-theme">{theme.state.systemTheme}</div>
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
        data-testid="auto-btn"
        onClick={() => theme.setTheme('auto')}
      >
        Auto
      </button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    // Reset document classes
    document.documentElement.classList.remove('light', 'dark')

    // Reset all mock calls and restore implementations
    vi.restoreAllMocks()

    // Re-create fresh mocks
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
      configurable: true,
    })

    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query) => ({
        matches: false, // Default to light mode
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('should initialize with light theme and light system theme', async () => {
    render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
      expect(screen.getByTestId('user-theme')).toHaveTextContent('light')
      expect(screen.getByTestId('system-theme')).toHaveTextContent('light')
      expect(document.documentElement).toHaveClass('light')
    })
    // Note: theme-transition class may also be present during transitions
  })

  it('should initialize with light theme even when system prefers dark', () => {
    // Mock dark mode preference
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    expect(screen.getByTestId('user-theme')).toHaveTextContent('light')
    expect(screen.getByTestId('system-theme')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('light')
    // Note: theme-transition class may also be present during transitions
  })

  it('should toggle theme correctly', async () => {
    render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    const toggleBtn = screen.getByTestId('toggle-btn')

    // Initial state should be light
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    expect(document.documentElement).toHaveClass('light')
    // Note: theme-transition class may also be present during transitions

    // Toggle to dark
    fireEvent.click(toggleBtn)
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
      expect(document.documentElement).toHaveClass('dark')
      // Note: theme-transition class may also be present during transitions
    })

    // Toggle back to light
    fireEvent.click(toggleBtn)
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
      expect(document.documentElement).toHaveClass('light')
      // Note: theme-transition class may also be present during transitions
    })
  })

  it('should set specific themes correctly', async () => {
    render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    const lightBtn = screen.getByTestId('light-btn')
    const darkBtn = screen.getByTestId('dark-btn')
    const autoBtn = screen.getByTestId('auto-btn')

    // Set to light
    fireEvent.click(lightBtn)
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
      expect(screen.getByTestId('user-theme')).toHaveTextContent('light')
      expect(document.documentElement).toHaveClass('light')
      // Note: theme-transition class may also be present during transitions
    })

    // Set to dark
    fireEvent.click(darkBtn)
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
      expect(screen.getByTestId('user-theme')).toHaveTextContent('dark')
      expect(document.documentElement).toHaveClass('dark')
      // Note: theme-transition class may also be present during transitions
    })

    // Set to auto
    fireEvent.click(autoBtn)
    await waitFor(() => {
      expect(screen.getByTestId('user-theme')).toHaveTextContent('auto')
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light') // system is light
      expect(document.documentElement).toHaveClass('light')
      // Note: theme-transition class may also be present during transitions
    })
  })

  it('should save theme preference to localStorage', async () => {
    render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    const darkBtn = screen.getByTestId('dark-btn')

    fireEvent.click(darkBtn)
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('kogoro-theme', 'dark')
    })

    const lightBtn = screen.getByTestId('light-btn')
    fireEvent.click(lightBtn)
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('kogoro-theme', 'light')
    })
  })

  it('should load saved theme from localStorage', () => {
    // Mock localStorage to return a saved theme
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue('dark'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    })

    render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('kogoro-theme')
    expect(screen.getByTestId('user-theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('should respond to system theme changes when in auto mode', async () => {
    let mediaQueryCallback: ((e: MediaQueryListEvent) => void) | null = null
    let mediaQueryInstance: MediaQueryList | null = null

    // Mock matchMedia with event listener support
    window.matchMedia = vi.fn().mockImplementation((query) => {
      mediaQueryInstance = {
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(
          (event: string, callback: (e: MediaQueryListEvent) => void) => {
            if (event === 'change') {
              mediaQueryCallback = callback
            }
          }
        ),
        removeEventListener: vi.fn(
          (event: string, callback: (e: MediaQueryListEvent) => void) => {
            if (event === 'change' && callback === mediaQueryCallback) {
              mediaQueryCallback = null
            }
          }
        ),
        dispatchEvent: vi.fn(),
      }
      return mediaQueryInstance
    })

    render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    // Should start in light mode (new default)
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    expect(screen.getByTestId('user-theme')).toHaveTextContent('light')
    expect(document.documentElement).toHaveClass('light')
    // Note: theme-transition class may also be present during transitions

    // Switch to auto mode first
    const autoBtn = screen.getByTestId('auto-btn')
    fireEvent.click(autoBtn)

    await waitFor(() => {
      expect(screen.getByTestId('user-theme')).toHaveTextContent('auto')
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light') // system is light
      expect(document.documentElement).toHaveClass('light')
    })

    // Simulate system theme change to dark
    if (mediaQueryCallback && mediaQueryInstance) {
      // Update the matches property
      mediaQueryInstance.matches = true

      const mockEvent = {
        matches: true,
        media: '(prefers-color-scheme: dark)',
      } as MediaQueryListEvent
      mediaQueryCallback(mockEvent)
    }

    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
      expect(screen.getByTestId('system-theme')).toHaveTextContent('dark')
      expect(document.documentElement).toHaveClass('dark')
      // Note: theme-transition class may also be present during transitions
    })
  })

  it('should not respond to system theme changes when not in auto mode', async () => {
    let mediaQueryCallback: ((e: MediaQueryListEvent) => void) | null = null

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(
        (event: string, callback: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            mediaQueryCallback = callback
          }
        }
      ),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    // Set to explicit light mode
    const lightBtn = screen.getByTestId('light-btn')
    fireEvent.click(lightBtn)
    await waitFor(() => {
      expect(screen.getByTestId('user-theme')).toHaveTextContent('light')
    })

    // Simulate system theme change to dark
    if (mediaQueryCallback) {
      const mockEvent = {
        matches: true,
        media: '(prefers-color-scheme: dark)',
      } as MediaQueryListEvent
      mediaQueryCallback(mockEvent)
    }

    // Should remain in light mode
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
      expect(screen.getByTestId('user-theme')).toHaveTextContent('light')
      expect(document.documentElement).toHaveClass('light')
      // Note: theme-transition class may also be present during transitions
    })
  })

  it('should throw error when useTheme is used outside ThemeProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(() => <TestComponent />)
    }).toThrow('useTheme must be used within a ThemeProvider')

    consoleSpy.mockRestore()
  })

  describe('localStorage validation', () => {
    it('should handle null localStorage data gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
    })

    it('should handle undefined localStorage data gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(undefined),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
    })

    it('should handle empty string localStorage data gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(''),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('kogoro-theme')
    })

    it('should handle invalid theme values gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('invalid-theme'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('kogoro-theme')
    })

    it('should handle non-string localStorage data gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(123),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
    })

    it('should handle malicious script content gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('<script>alert("xss")</script>'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('kogoro-theme')
    })

    it('should handle javascript: URL content gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('javascript:alert("xss")'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('kogoro-theme')
    })

    it('should handle localStorage access errors gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockImplementation(() => {
          throw new Error('Access denied')
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
    })

    it('should handle localStorage quota exceeded errors on save', async () => {
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
          <TestComponent />
        </ThemeProvider>
      ))

      const darkBtn = screen.getByTestId('dark-btn')
      fireEvent.click(darkBtn)

      // Theme should still change in the UI even if save fails
      await waitFor(() => {
        expect(screen.getByTestId('user-theme')).toHaveTextContent('dark')
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })

    it('should handle localStorage being unavailable', () => {
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
    })

    it('should validate and accept valid theme values', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('dark'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent('dark')
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled()
    })

    it('should handle whitespace-only strings gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('   '),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('kogoro-theme')
    })

    it('should handle case sensitivity correctly', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('DARK'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      })

      render(() => (
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      ))

      expect(screen.getByTestId('user-theme')).toHaveTextContent(
        UI_CONFIG.defaultTheme
      )
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('kogoro-theme')
    })
  })
})
