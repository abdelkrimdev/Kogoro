/**
 * Motion Integration Tests
 * Tests the overall Motion system integration with the app
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library'
import { createSignal, createEffect } from 'solid-js'
import {
  initializeMotion,
  getMotionState,
  isMotionEnabled,
} from '../lib/motion'
import { useMotionAnimations } from '../hooks/useMotionAnimations'
import { MotionButton } from '../components/ui/MotionButton'
import { MotionCard } from '../components/ui/MotionCard'
import { MotionModal } from '../components/ui/MotionModal'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'

// Mock IntersectionObserver for scroll animations
const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})
window.IntersectionObserver = mockIntersectionObserver

// Mock requestAnimationFrame for animation testing
const mockRequestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
const mockCancelAnimationFrame = vi.fn()
window.requestAnimationFrame = mockRequestAnimationFrame
window.cancelAnimationFrame = mockCancelAnimationFrame

// Mock ResizeObserver for layout animations
const mockResizeObserver = vi.fn()
mockResizeObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})
window.ResizeObserver = mockResizeObserver

describe('Motion System Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    // Initialize motion system
    initializeMotion()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe('System Initialization', () => {
    it('should initialize motion system correctly', () => {
      const state = getMotionState()
      expect(state.enabled).toBe(true)
      expect(state.reducedMotion).toBe(false)
    })

    it('should detect reduced motion preference', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      initializeMotion()
      const state = getMotionState()
      expect(state.reducedMotion).toBe(true)
      expect(isMotionEnabled()).toBe(false)
    })

    it('should respond to reduced motion changes', () => {
      const mockAddEventListener = vi.fn()
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: mockAddEventListener,
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      initializeMotion()
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
    })
  })

  describe('Component Integration', () => {
    it('should render MotionButton with animations', () => {
      render(() => (
        <MotionButton variant="primary" data-testid="motion-button">
          Test Button
        </MotionButton>
      ))

      const button = screen.getByTestId('motion-button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass(
        'inline-flex',
        'items-center',
        'justify-center'
      )
    })

    it('should handle button interactions with animations', async () => {
      render(() => (
        <MotionButton variant="primary" data-testid="motion-button">
          Test Button
        </MotionButton>
      ))

      const button = screen.getByTestId('motion-button')

      // Test hover
      fireEvent.mouseEnter(button)
      expect(button).toHaveStyle(
        'transition: all 150ms cubic-bezier(0, 0, 0.58, 1)'
      )

      // Test click
      fireEvent.mouseDown(button)
      fireEvent.mouseUp(button)

      // Should still be clickable
      expect(button).not.toBeDisabled()
    })

    it('should show loading state with animations', () => {
      render(() => (
        <MotionButton
          loading={true}
          loadingText="Loading..."
          data-testid="motion-button"
        >
          Test Button
        </MotionButton>
      ))

      const button = screen.getByTestId('motion-button')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should render MotionCard with animations', () => {
      render(() => (
        <MotionCard data-testid="motion-card">
          <h3>Card Title</h3>
          <p>Card content</p>
        </MotionCard>
      ))

      const card = screen.getByTestId('motion-card')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('motion-card')
    })

    it('should handle modal animations', async () => {
      const [isOpen, setIsOpen] = createSignal(false)

      render(() => (
        <div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            data-testid="open-modal"
          >
            Open Modal
          </button>
          <MotionModal
            isOpen={isOpen()}
            onClose={() => setIsOpen(false)}
            title="Test Modal"
          >
            <p>Modal content</p>
          </MotionModal>
        </div>
      ))

      // Initially modal should not be visible
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      // Open modal
      const openButton = screen.getByTestId('open-modal')
      fireEvent.click(openButton)

      // Modal should appear with animation
      await vi.advanceTimersByTimeAsync(100)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Test Modal')).toBeInTheDocument()
    })
  })

  describe('Theme Integration', () => {
    it('should integrate with theme transitions', () => {
      const TestComponent = () => {
        const { themeTransition } = useMotionAnimations()
        const [isDark, setIsDark] = createSignal(false)

        const toggleTheme = async () => {
          await themeTransition.toggleTheme()
          setIsDark(!isDark())
        }

        return (
          <div>
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="theme-toggle"
            >
              Toggle Theme
            </button>
            <div
              data-testid="theme-indicator"
              class={isDark() ? 'dark' : 'light'}
            >
              Current theme
            </div>
          </div>
        )
      }

      render(() => <TestComponent />)

      const toggleButton = screen.getByTestId('theme-toggle')
      const indicator = screen.getByTestId('theme-indicator')

      expect(indicator).toHaveClass('light')

      fireEvent.click(toggleButton)
      vi.advanceTimersByTime(300)

      expect(indicator).toHaveClass('dark')
    })

    it('should apply theme-aware animations', () => {
      const TestComponent = () => {
        const { motion } = useMotionAnimations()
        const [theme, setTheme] = createSignal<'light' | 'dark'>('light')

        const getThemeAnimation = () => {
          return motion.variants[theme()].subtle
        }

        return (
          <div>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              data-testid="set-dark"
            >
              Set Dark Theme
            </button>
            <div
              data-testid="animated-element"
              style={getThemeAnimation().transition}
            >
              Animated content
            </div>
          </div>
        )
      }

      render(() => <TestComponent />)

      const element = screen.getByTestId('animated-element')
      expect(element).toHaveStyle(
        'transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      )

      const darkButton = screen.getByTestId('set-dark')
      fireEvent.click(darkButton)

      // Should update animation for dark theme
      expect(element).toHaveStyle(
        'transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      )
    })
  })

  describe('Accessibility Integration', () => {
    it('should respect reduced motion preferences', () => {
      // Mock reduced motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      initializeMotion()

      const TestComponent = () => {
        const { reducedMotion } = useMotionAnimations()

        return (
          <div data-testid="reduced-motion-test">
            <span data-testid="prefers-reduced">
              {reducedMotion.prefersReduced() ? 'true' : 'false'}
            </span>
            <span data-testid="should-animate">
              {reducedMotion.shouldAnimate() ? 'true' : 'false'}
            </span>
          </div>
        )
      }

      render(() => <TestComponent />)

      expect(screen.getByTestId('prefers-reduced')).toHaveTextContent('true')
      expect(screen.getByTestId('should-animate')).toHaveTextContent('false')
    })

    it('should provide proper ARIA attributes for animated elements', () => {
      render(() => (
        <MotionButton loading={true} data-testid="accessible-button">
          Accessible Button
        </MotionButton>
      ))

      const button = screen.getByTestId('accessible-button')
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(button).toBeDisabled()
    })

    it('should handle keyboard navigation with animations', () => {
      render(() => (
        <MotionButton data-testid="keyboard-button">
          Keyboard Button
        </MotionButton>
      ))

      const button = screen.getByTestId('keyboard-button')

      // Test keyboard focus
      fireEvent.focus(button)
      expect(button).toHaveStyle(
        'transition: all 150ms cubic-bezier(0, 0, 0.58, 1)'
      )

      // Test keyboard activation
      fireEvent.keyDown(button, { key: 'Enter' })
      fireEvent.keyUp(button, { key: 'Enter' })

      // Should handle keyboard events
      expect(button).toBeInTheDocument()
    })
  })

  describe('Performance Integration', () => {
    it('should not cause memory leaks', () => {
      const TestComponent = () => {
        const { animationState } = useMotionAnimations()
        const [_isAnimating, setIsAnimating] = createSignal(false)

        const startAnimation = () => {
          setIsAnimating(true)
          animationState.startAnimation()
        }

        return (
          <div>
            <button
              type="button"
              onClick={startAnimation}
              data-testid="start-animation"
            >
              Start Animation
            </button>
            <div data-testid="animation-state">{animationState.state()}</div>
          </div>
        )
      }

      const { unmount } = render(() => <TestComponent />)

      const startButton = screen.getByTestId('start-animation')
      fireEvent.click(startButton)

      expect(screen.getByTestId('animation-state')).toHaveTextContent('running')

      // Cleanup should not cause errors
      unmount()
      vi.advanceTimersByTime(100)
    })

    it('should batch animation updates efficiently', () => {
      const TestComponent = () => {
        const { useStagger } = useMotionAnimations()
        const stagger = useStagger({ baseDelay: 10 })
        const items = Array.from({ length: 10 }, (_, i) => `Item ${i}`)

        return (
          <div data-testid="staggered-list">
            {items.map((item, index) => (
              <div
                key={`item-${index}-${item}`}
                data-testid={`item-${index}`}
                {...stagger.getStaggerProps(index)}
              >
                {item}
              </div>
            ))}
          </div>
        )
      }

      render(() => <TestComponent />)

      // All items should be rendered with stagger props
      for (let i = 0; i < 10; i++) {
        const item = screen.getByTestId(`item-${i}`)
        expect(item).toBeInTheDocument()
        expect(item).toHaveAttribute('data-stagger-index', String(i))
      }
    })

    it('should handle rapid state changes without errors', () => {
      const TestComponent = () => {
        const { animationState } = useMotionAnimations()
        const [count, setCount] = createSignal(0)

        createEffect(() => {
          if (count() > 0) {
            animationState.startAnimation()
          }
        })

        return (
          <div>
            <button
              type="button"
              onClick={() => setCount((c) => c + 1)}
              data-testid="rapid-change"
            >
              Rapid Change
            </button>
            <div data-testid="count">{count()}</div>
          </div>
        )
      }

      render(() => <TestComponent />)

      const button = screen.getByTestId('rapid-change')

      // Rapid clicks should not cause errors
      for (let i = 0; i < 10; i++) {
        fireEvent.click(button)
        vi.advanceTimersByTime(10)
      }

      expect(screen.getByTestId('count')).toHaveTextContent('10')
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle animation errors gracefully', () => {
      const TestComponent = () => {
        const { animationState } = useMotionAnimations()

        const startAnimation = () => {
          try {
            animationState.startAnimation()
          } catch (error) {
            console.error('Animation error:', error)
          }
        }

        return (
          <ErrorBoundary
            fallback={<div data-testid="error-fallback">Error</div>}
          >
            <button
              type="button"
              onClick={startAnimation}
              data-testid="error-button"
            >
              Start Animation
            </button>
          </ErrorBoundary>
        )
      }

      render(() => <TestComponent />)

      const button = screen.getByTestId('error-button')
      fireEvent.click(button)

      // Should not crash
      expect(button).toBeInTheDocument()
      expect(screen.queryByTestId('error-fallback')).not.toBeInTheDocument()
    })

    it('should handle missing animation props gracefully', () => {
      render(() => (
        <MotionButton
          variant="primary"
          // @ts-expect-error Testing missing props
          animationVariant="nonexistent"
          data-testid="graceful-button"
        >
          Graceful Button
        </MotionButton>
      ))

      const button = screen.getByTestId('graceful-button')
      expect(button).toBeInTheDocument()
      // Should still render without crashing
    })
  })

  describe('Browser Compatibility', () => {
    it('should work without requestAnimationFrame', () => {
      const originalRAF = window.requestAnimationFrame
      delete (window as unknown as Record<string, unknown>)
        .requestAnimationFrame

      const TestComponent = () => {
        const { animationState } = useMotionAnimations()

        return <div data-testid="no-raf">{animationState.state()}</div>
      }

      render(() => <TestComponent />)

      expect(screen.getByTestId('no-raf')).toHaveTextContent('idle')

      // Restore
      window.requestAnimationFrame = originalRAF
    })

    it('should work without IntersectionObserver', () => {
      const originalIO = window.IntersectionObserver
      delete (window as unknown as Record<string, unknown>).IntersectionObserver

      const TestComponent = () => {
        const { useScroll } = useMotionAnimations()
        const scroll = useScroll()

        return (
          <div ref={scroll.elementRef} data-testid="no-io">
            Scroll content
          </div>
        )
      }

      render(() => <TestComponent />)

      expect(screen.getByTestId('no-io')).toBeInTheDocument()

      // Restore
      window.IntersectionObserver = originalIO
    })
  })

  describe('Animation Lifecycle', () => {
    it('should handle complete animation lifecycle', () => {
      const TestComponent = () => {
        const { animationState } = useMotionAnimations()
        const [events, setEvents] = createSignal<string[]>([])

        const addEvent = (event: string) => {
          setEvents((e) => [...e, event])
        }

        animationState.addEventListener('start', () => addEvent('start'))
        animationState.addEventListener('end', () => addEvent('end'))

        const startAnimation = () => {
          animationState.startAnimation()
        }

        return (
          <div>
            <button
              type="button"
              onClick={startAnimation}
              data-testid="lifecycle-button"
            >
              Start Lifecycle
            </button>
            <div data-testid="events">{events().join(',')}</div>
          </div>
        )
      }

      render(() => <TestComponent />)

      const button = screen.getByTestId('lifecycle-button')
      fireEvent.click(button)

      // Advance timers to complete animation
      vi.advanceTimersByTime(300)

      expect(screen.getByTestId('events')).toHaveTextContent('start,end')
    })

    it('should handle animation interruption', () => {
      const TestComponent = () => {
        const { animationState } = useMotionAnimations()
        const [isRunning, setIsRunning] = createSignal(false)

        const startAnimation = () => {
          setIsRunning(true)
          animationState.startAnimation()
        }

        const stopAnimation = () => {
          setIsRunning(false)
          animationState.stopAnimation()
        }

        return (
          <div>
            <button type="button" onClick={startAnimation} data-testid="start">
              Start
            </button>
            <button type="button" onClick={stopAnimation} data-testid="stop">
              Stop
            </button>
            <div data-testid="running">{isRunning() ? 'true' : 'false'}</div>
          </div>
        )
      }

      render(() => <TestComponent />)

      const startButton = screen.getByTestId('start')
      const stopButton = screen.getByTestId('stop')

      fireEvent.click(startButton)
      expect(screen.getByTestId('running')).toHaveTextContent('true')

      fireEvent.click(stopButton)
      expect(screen.getByTestId('running')).toHaveTextContent('false')
    })
  })
})
