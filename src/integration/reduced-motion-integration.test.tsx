/**
 * Reduced Motion Integration Tests
 * Tests reduced motion preferences and their impact on animations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/solidjs/web'
import { createSignal, createEffect } from 'solid-js'
import {
  initializeMotion,
  isMotionEnabled,
  getDuration,
  getDelay,
} from '../lib/motion'
import {
  useReducedMotion,
  useMotionAnimations,
} from '../hooks/useMotionAnimations'
import { MotionButton } from '../components/ui/MotionButton'
import { MotionCard } from '../components/ui/MotionCard'

// Mock window and browser APIs
const mockMatchMedia = vi.fn()
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
})

const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})
window.IntersectionObserver = mockIntersectionObserver

describe('Reduced Motion Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset matchMedia mock
    mockMatchMedia.mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })

    // Initialize motion system
    initializeMotion()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe('Motion System Detection', () => {
    it('should detect when reduced motion is not preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      initializeMotion()

      expect(isMotionEnabled()).toBe(true)
    })

    it('should detect when reduced motion is preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      initializeMotion()

      expect(isMotionEnabled()).toBe(false)
    })

    it('should return zero duration when motion is disabled', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      initializeMotion()

      expect(getDuration('fast')).toBe(0)
      expect(getDuration('normal')).toBe(0)
      expect(getDuration('slow')).toBe(0)
    })

    it('should return zero delay when motion is disabled', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      initializeMotion()

      expect(getDelay('short')).toBe(0)
      expect(getDelay('normal')).toBe(0)
      expect(getDelay('long')).toBe(0)
    })

    it('should return normal durations when motion is enabled', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      initializeMotion()

      expect(getDuration('fast')).toBe(150)
      expect(getDuration('normal')).toBe(300)
      expect(getDuration('slow')).toBe(500)
    })
  })

  describe('useReducedMotion Hook', () => {
    it('should initialize with reduced motion detection', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const TestComponent = () => {
        const reducedMotion = useReducedMotion()

        return (
          <div data-testid="reduced-motion-hook">
            <span data-testid="prefers-reduced">
              {reducedMotion.prefersReduced().toString()}
            </span>
            <span data-testid="should-animate">
              {reducedMotion.shouldAnimate().toString()}
            </span>
          </div>
        )
      }

      render(() => <TestComponent />)

      expect(screen.getByTestId('prefers-reduced')).toHaveTextContent('true')
      expect(screen.getByTestId('should-animate')).toHaveTextContent('false')
    })

    it('should watch for reduced motion changes', () => {
      const mockAddEventListener = vi.fn()
      mockMatchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const TestComponent = () => {
        const reducedMotion = useReducedMotion()

        return (
          <div data-testid="reduced-motion-watch">
            <span data-testid="prefers-reduced">
              {reducedMotion.prefersReduced().toString()}
            </span>
          </div>
        )
      }

      render(() => <TestComponent />)

      expect(mockAddEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
    })

    it('should provide watch callback functionality', () => {
      const TestComponent = () => {
        const reducedMotion = useReducedMotion()
        const [callbackCount, setCallbackCount] = createSignal(0)

        createEffect(() => {
          const unwatch = reducedMotion.watch((prefersReduced) => {
            setCallbackCount((c) => c + 1)
          })

          return unwatch
        })

        return (
          <div data-testid="reduced-motion-callback">
            <span data-testid="callback-count">{callbackCount()}</span>
          </div>
        )
      }

      render(() => <TestComponent />)

      expect(screen.getByTestId('reduced-motion-callback')).toBeInTheDocument()
    })
  })

  describe('Component Integration', () => {
    it('should disable MotionButton animations when reduced motion is preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      render(() => (
        <MotionButton data-testid="motion-button-reduced">
          Reduced Motion Button
        </MotionButton>
      ))

      const button = screen.getByTestId('motion-button-reduced')

      // Should have instant transitions (0 duration)
      expect(button).toHaveStyle(
        'transition: all 0ms cubic-bezier(0, 0, 0.58, 1)'
      )
    })

    it('should enable MotionButton animations when reduced motion is not preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      render(() => (
        <MotionButton data-testid="motion-button-normal">
          Normal Motion Button
        </MotionButton>
      ))

      const button = screen.getByTestId('motion-button-normal')

      // Should have normal transitions
      expect(button).toHaveStyle(
        'transition: all 150ms cubic-bezier(0, 0, 0.58, 1)'
      )
    })

    it('should disable MotionCard animations when reduced motion is preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      render(() => (
        <MotionCard clickable data-testid="motion-card-reduced">
          Reduced Motion Card
        </MotionCard>
      ))

      const card = screen.getByTestId('motion-card-reduced')

      // Should not have hover animations
      fireEvent.mouseEnter(card)
      expect(card).toHaveStyle('transform: translateY(0px)')
    })

    it('should enable MotionCard animations when reduced motion is not preferred', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      render(() => (
        <MotionCard clickable data-testid="motion-card-normal">
          Normal Motion Card
        </MotionCard>
      ))

      const card = screen.getByTestId('motion-card-normal')

      // Should have hover animations
      fireEvent.mouseEnter(card)
      expect(card).toHaveStyle('transform: translateY(-4px)')
    })
  })

  describe('Hook Integration', () => {
    it('should respect reduced motion in useStaggerAnimation', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const TestComponent = () => {
        const { useStagger } = useMotionAnimations()
        const stagger = useStagger({ baseDelay: 50 })

        return (
          <div data-testid="stagger-reduced">
            <span data-testid="delay-2">{stagger.getStaggerDelay(2)}</span>
          </div>
        )
      }

      render(() => <TestComponent />)

      // Should return 0 delay when reduced motion is preferred
      expect(screen.getByTestId('delay-2')).toHaveTextContent('0')
    })

    it('should respect reduced motion in useScrollAnimation', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const TestComponent = () => {
        const { useScroll } = useMotionAnimations()
        const scroll = useScroll()
        const styles = scroll.getAnimationStyles()

        return (
          <div data-testid="scroll-reduced">
            <span data-testid="opacity">{styles.opacity}</span>
            <span data-testid="transform">{styles.transform}</span>
          </div>
        )
      }

      render(() => <TestComponent />)

      // Should return visible state immediately when reduced motion is preferred
      expect(screen.getByTestId('opacity')).toHaveTextContent('1')
      expect(screen.getByTestId('transform')).toHaveTextContent('translateY(0)')
    })

    it('should respect reduced motion in useInteractionAnimation', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const TestComponent = () => {
        const { useInteraction } = useMotionAnimations()
        const interaction = useInteraction()
        const styles = interaction.getAnimationStyles()

        return (
          <div data-testid="interaction-reduced">
            <span data-testid="transition">{styles.transition}</span>
          </div>
        )
      }

      render(() => <TestComponent />)

      // Should have instant transitions when reduced motion is preferred
      expect(screen.getByTestId('transition')).toContain('0ms')
    })

    it('should respect reduced motion in useLoadingAnimation', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const TestComponent = () => {
        const { useLoading } = useMotionAnimations()
        const loading = useLoading({ type: 'spinner' })
        loading.startLoading()
        const props = loading.getLoadingProps()

        return (
          <div data-testid="loading-reduced">
            <span data-testid="animation">{props.style?.animation}</span>
          </div>
        )
      }

      render(() => <TestComponent />)

      // Should have no animation when reduced motion is preferred
      const animationElement = screen.getByTestId('animation')
      expect(animationElement.textContent || '').not.toContain('spin')
    })
  })

  describe('Dynamic Preference Changes', () => {
    it('should respond to reduced motion preference changes', () => {
      let mediaQueryCallback: ((event: MediaQueryListEvent) => void) | undefined

      mockMatchMedia.mockImplementation((query) => {
        const mediaQuery = {
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn((event, callback) => {
            if (event === 'change') {
              mediaQueryCallback = callback as any
            }
          }),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }
        return mediaQuery
      })

      const TestComponent = () => {
        const reducedMotion = useReducedMotion()

        return (
          <div data-testid="dynamic-reduced-motion">
            <span data-testid="prefers-reduced">
              {reducedMotion.prefersReduced().toString()}
            </span>
            <span data-testid="should-animate">
              {reducedMotion.shouldAnimate().toString()}
            </span>
          </div>
        )
      }

      render(() => <TestComponent />)

      expect(screen.getByTestId('prefers-reduced')).toHaveTextContent('false')
      expect(screen.getByTestId('should-animate')).toHaveTextContent('true')

      // Simulate reduced motion preference change
      if (mediaQueryCallback) {
        mediaQueryCallback({ matches: true } as MediaQueryListEvent)
      }

      expect(screen.getByTestId('prefers-reduced')).toHaveTextContent('true')
      expect(screen.getByTestId('should-animate')).toHaveTextContent('false')
    })

    it('should update animations when preference changes', () => {
      let mediaQueryCallback: ((event: MediaQueryListEvent) => void) | undefined

      mockMatchMedia.mockImplementation((query) => {
        const mediaQuery = {
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn((event, callback) => {
            if (event === 'change') {
              mediaQueryCallback = callback as any
            }
          }),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }
        return mediaQuery
      })

      const TestComponent = () => {
        const { useInteraction } = useMotionAnimations()
        const interaction = useInteraction()
        const styles = interaction.getAnimationStyles()

        return (
          <div data-testid="dynamic-animations">
            <span data-testid="transition">{styles.transition}</span>
          </div>
        )
      }

      render(() => <TestComponent />)

      // Initially should have normal animations
      expect(screen.getByTestId('transition')).toContain('150ms')

      // Simulate reduced motion preference change
      if (mediaQueryCallback) {
        mediaQueryCallback({ matches: true } as MediaQueryListEvent)
      }

      // Should update to instant animations
      expect(screen.getByTestId('transition')).toContain('0ms')
    })
  })

  describe('Accessibility Compliance', () => {
    it('should respect prefers-reduced-motion for accessibility', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const TestComponent = () => {
        const motion = useMotionAnimations()

        return (
          <div data-testid="accessibility-compliance">
            <span data-testid="motion-enabled">
              {motion.motion.isEnabled().toString()}
            </span>
            <span data-testid="duration-fast">
              {motion.motion.getDuration('fast')}
            </span>
            <span data-testid="duration-normal">
              {motion.motion.getDuration('normal')}
            </span>
          </div>
        )
      }

      render(() => <TestComponent />)

      expect(screen.getByTestId('motion-enabled')).toHaveTextContent('false')
      expect(screen.getByTestId('duration-fast')).toHaveTextContent('0')
      expect(screen.getByTestId('duration-normal')).toHaveTextContent('0')
    })

    it('should provide appropriate ARIA attributes', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      render(() => (
        <MotionButton loading={true} data-testid="accessible-reduced-motion">
          Accessible Button
        </MotionButton>
      ))

      const button = screen.getByTestId('accessible-reduced-motion')

      // Should still have proper ARIA attributes even with reduced motion
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(button).toBeDisabled()
    })

    it('should maintain keyboard navigation with reduced motion', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      render(() => (
        <MotionButton data-testid="keyboard-reduced-motion">
          Keyboard Button
        </MotionButton>
      ))

      const button = screen.getByTestId('keyboard-reduced-motion')

      // Should still support keyboard navigation
      fireEvent.focus(button)
      expect(button).toHaveFocus()

      fireEvent.keyDown(button, { key: 'Enter' })
      fireEvent.keyUp(button, { key: 'Enter' })

      expect(button).toBeInTheDocument()
    })
  })

  describe('Performance Impact', () => {
    it('should improve performance with reduced motion', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const TestComponent = () => {
        const { useStagger } = useMotionAnimations()
        const stagger = useStagger({ baseDelay: 50 })

        return (
          <div data-testid="performance-reduced-motion">
            {Array.from({ length: 100 }, (_, i) => (
              <div
                key={i}
                data-testid={`item-${i}`}
                {...stagger.getStaggerProps(i)}
              >
                Item {i}
              </div>
            ))}
          </div>
        )
      }

      const startTime = performance.now()
      render(() => <TestComponent />)
      const renderTime = performance.now() - startTime

      // Should render quickly with reduced motion
      expect(renderTime).toBeLessThan(100)

      // All items should have zero delay
      for (let i = 0; i < 10; i++) {
        const item = screen.getByTestId(`item-${i}`)
        expect(item.style.animationDelay).toBe('0ms')
        expect(item.style.transitionDelay).toBe('0ms')
      }
    })

    it('should reduce animation frame usage with reduced motion', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const mockRequestAnimationFrame = vi.fn()
      window.requestAnimationFrame = mockRequestAnimationFrame

      const TestComponent = () => {
        const { useAnimation } = useMotionAnimations()
        const animation = useAnimation()

        createEffect(() => {
          animation.startAnimation()
        })

        return (
          <div data-testid="frame-reduced-motion">
            <span data-testid="animation-state">{animation.state()}</span>
          </div>
        )
      }

      render(() => <TestComponent />)

      // Should not use requestAnimationFrame when reduced motion is preferred
      expect(mockRequestAnimationFrame).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing matchMedia gracefully', () => {
      // Remove matchMedia
      delete (window as any).matchMedia

      expect(() => {
        const TestComponent = () => {
          const reducedMotion = useReducedMotion()

          return (
            <div data-testid="no-matchmedia">
              <span data-testid="prefers-reduced">
                {reducedMotion.prefersReduced().toString()}
              </span>
            </div>
          )
        }

        render(() => <TestComponent />)
      }).not.toThrow()
    })

    it('should handle invalid media query gracefully', () => {
      mockMatchMedia.mockImplementation(() => {
        throw new Error('Invalid media query')
      })

      expect(() => {
        const TestComponent = () => {
          const reducedMotion = useReducedMotion()

          return (
            <div data-testid="invalid-query">
              <span data-testid="prefers-reduced">
                {reducedMotion.prefersReduced().toString()}
              </span>
            </div>
          )
        }

        render(() => <TestComponent />)
      }).not.toThrow()
    })

    it('should handle event listener errors gracefully', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(() => {
          throw new Error('Event listener error')
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      expect(() => {
        const TestComponent = () => {
          const reducedMotion = useReducedMotion()

          return (
            <div data-testid="listener-error">
              <span data-testid="prefers-reduced">
                {reducedMotion.prefersReduced().toString()}
              </span>
            </div>
          )
        }

        render(() => <TestComponent />)
      }).not.toThrow()
    })
  })
})
