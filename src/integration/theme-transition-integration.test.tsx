/**
 * Integration tests for theme transitions with ThemeContext
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, waitFor, cleanup } from '@solidjs/testing-library'
import { ThemeProvider, useTheme } from '../contexts/ThemeContext'

// Mock theme transitions
vi.mock('../lib/theme-transitions', () => ({
  createSmoothThemeTransition: vi.fn((callback) => {
    callback()
    return Promise.resolve()
  }),
  getTransitionDuration: () => 300,
  watchReducedMotion: () => () => {},
  prefersReducedMotion: () => false,
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

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

// Test component that uses theme
function TestComponent() {
  const { state, setTheme, toggleTheme } = useTheme()

  return (
    <div>
      <div data-testid="current-theme">{state.effectiveTheme}</div>
      <div data-testid="user-theme">{state.theme}</div>
      <button
        data-testid="set-light"
        type="button"
        onClick={() => setTheme('light')}
      >
        Set Light
      </button>
      <button
        data-testid="set-dark"
        type="button"
        onClick={() => setTheme('dark')}
      >
        Set Dark
      </button>
      <button
        data-testid="set-auto"
        type="button"
        onClick={() => setTheme('auto')}
      >
        Set Auto
      </button>
      <button data-testid="toggle" type="button" onClick={toggleTheme}>
        Toggle
      </button>
    </div>
  )
}

describe('Theme Transition Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue('light')

    // Reset document classes
    document.documentElement.className = ''
  })

  afterEach(() => {
    cleanup()
    document.documentElement.className = ''
  })

  it('should apply theme transitions when switching themes', async () => {
    const { getByTestId } = render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    // Initial theme should be light
    expect(getByTestId('current-theme').textContent).toBe('light')

    // Switch to dark theme
    const darkButton = getByTestId('set-dark')
    fireEvent.click(darkButton)

    // Wait for theme change
    await waitFor(() => {
      expect(getByTestId('current-theme').textContent).toBe('dark')
    })

    // Verify theme classes are applied to document
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).not.toHaveClass('light')
  })

  it('should handle theme toggle with transitions', async () => {
    const { getByTestId } = render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    // Initial theme
    expect(getByTestId('current-theme').textContent).toBe('light')

    // Toggle theme
    const toggleButton = getByTestId('toggle')
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(getByTestId('current-theme').textContent).toBe('dark')
    })

    // Verify theme classes are applied
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).not.toHaveClass('light')

    // Toggle back
    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(getByTestId('current-theme').textContent).toBe('light')
    })

    // Verify theme classes are updated
    expect(document.documentElement).toHaveClass('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('should handle auto theme with system preference changes', async () => {
    // Mock system theme as dark
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { getByTestId } = render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    // Set to auto theme
    const autoButton = getByTestId('set-auto')
    fireEvent.click(autoButton)

    await waitFor(() => {
      expect(getByTestId('current-theme').textContent).toBe('dark')
    })

    expect(getByTestId('user-theme').textContent).toBe('auto')
  })

  it('should handle rapid theme changes gracefully', async () => {
    const { getByTestId } = render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    // Rapid theme changes
    fireEvent.click(getByTestId('set-dark'))
    fireEvent.click(getByTestId('set-light'))
    fireEvent.click(getByTestId('set-dark'))
    fireEvent.click(getByTestId('set-light'))

    await waitFor(() => {
      expect(getByTestId('current-theme').textContent).toBe('light')
    })
  })

  it('should maintain theme state during transitions', async () => {
    const { getByTestId } = render(() => (
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    ))

    const initialTheme = getByTestId('current-theme').textContent

    // Start theme change
    fireEvent.click(getByTestId('set-dark'))

    // Theme should update immediately in state
    expect(getByTestId('user-theme').textContent).toBe('dark')

    // Wait for DOM update
    await waitFor(() => {
      expect(getByTestId('current-theme').textContent).toBe('dark')
    })

    expect(getByTestId('current-theme').textContent).not.toBe(initialTheme)
  })
})
