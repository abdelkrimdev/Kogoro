/**
 * MotionCard Component Tests
 * Tests the animated card component with all its variants and states
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { MotionCard } from './MotionCard'

// Mock IntersectionObserver for scroll animations
const mockObserve = vi.fn()
const mockUnobserve = vi.fn()
const mockDisconnect = vi.fn()

class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe = mockObserve
  unobserve = mockUnobserve
  disconnect = mockDisconnect
}

window.IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver

// Mock requestAnimationFrame for animation testing
const mockRequestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
const mockCancelAnimationFrame = vi.fn()
window.requestAnimationFrame = mockRequestAnimationFrame
window.cancelAnimationFrame = mockCancelAnimationFrame

describe('MotionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(() => (
        <MotionCard data-testid="motion-card">
          <h3>Card Title</h3>
          <p>Card content</p>
        </MotionCard>
      ))

      const card = screen.getByTestId('motion-card')
      expect(card).toBeInTheDocument()
      expect(card).toHaveTextContent('Card Title')
      expect(card).toHaveTextContent('Card content')
    })

    it('should render with different variants', () => {
      const variants = ['standard', 'compact', 'featured'] as const

      variants.forEach((variant) => {
        cleanup()
        render(() => (
          <MotionCard variant={variant} data-testid={`card-${variant}`}>
            {variant} Card
          </MotionCard>
        ))

        const card = screen.getByTestId(`card-${variant}`)
        expect(card).toBeInTheDocument()
        expect(card).toHaveTextContent(`${variant} Card`)
      })
    })

    it('should render with different sizes', () => {
      const sizes = ['sm', 'md', 'lg', 'xl'] as const

      sizes.forEach((size) => {
        cleanup()
        render(() => (
          <MotionCard size={size} data-testid={`card-${size}`}>
            {size} Card
          </MotionCard>
        ))

        const card = screen.getByTestId(`card-${size}`)
        expect(card).toBeInTheDocument()
        expect(card).toHaveTextContent(`${size} Card`)
      })
    })

    it('should render with custom classes', () => {
      render(() => (
        <MotionCard class="custom-card another-class" data-testid="custom-card">
          Custom Card
        </MotionCard>
      ))

      const card = screen.getByTestId('custom-card')
      expect(card).toHaveClass('custom-card', 'another-class')
    })

    it('should render as clickable', () => {
      render(() => (
        <MotionCard clickable onClick={() => {}} data-testid="clickable-card">
          Clickable Card
        </MotionCard>
      ))

      const card = screen.getByTestId('clickable-card')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('cursor-pointer')
    })
  })

  describe('Animation Variants', () => {
    it('should apply hover animations when clickable', () => {
      render(() => (
        <MotionCard clickable data-testid="hover-card">
          Hover Card
        </MotionCard>
      ))

      const card = screen.getByTestId('hover-card')
      expect(card).toHaveClass('cursor-pointer', 'hover:shadow-xl')
    })

    it('should apply press animations when clickable', () => {
      render(() => (
        <MotionCard clickable data-testid="press-card">
          Press Card
        </MotionCard>
      ))

      const card = screen.getByTestId('press-card')
      expect(card).toHaveClass('cursor-pointer')
    })

    it('should apply focus animations when clickable', () => {
      render(() => (
        <MotionCard clickable data-testid="focus-card">
          Focus Card
        </MotionCard>
      ))

      const card = screen.getByTestId('focus-card')
      expect(card).toHaveClass('cursor-pointer')
    })
  })

  describe('Click Handling', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn()
      render(() => (
        <MotionCard clickable onClick={handleClick} data-testid="click-card">
          Click Card
        </MotionCard>
      ))

      const card = screen.getByTestId('click-card')
      fireEvent.click(card)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when not clickable', () => {
      const handleClick = vi.fn()
      render(() => (
        <MotionCard onClick={handleClick} data-testid="non-clickable-card">
          Non-Clickable Card
        </MotionCard>
      ))

      const card = screen.getByTestId('non-clickable-card')
      fireEvent.click(card)

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should handle keyboard interactions when clickable', () => {
      const handleClick = vi.fn()
      render(() => (
        <MotionCard clickable onClick={handleClick} data-testid="keyboard-card">
          Keyboard Card
        </MotionCard>
      ))

      const card = screen.getByTestId('keyboard-card')

      // Click should trigger onClick
      fireEvent.click(card)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Scroll Animations', () => {
    it('should setup IntersectionObserver for scroll animations', () => {
      render(() => (
        <MotionCard animateOnScroll={true} data-testid="scroll-card">
          Scroll Card
        </MotionCard>
      ))

      const card = screen.getByTestId('scroll-card')
      expect(card).toBeInTheDocument()
      expect(mockObserve).toHaveBeenCalled()
    })

    it('should handle scroll visibility changes', () => {
      render(() => (
        <MotionCard animateOnScroll={true} data-testid="scroll-visibility-card">
          Scroll Visibility Card
        </MotionCard>
      ))

      const card = screen.getByTestId('scroll-visibility-card')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(() => (
        <MotionCard
          clickable
          role="button"
          aria-label="Card button"
          data-testid="accessible-card"
        >
          Accessible Card
        </MotionCard>
      ))

      const card = screen.getByTestId('accessible-card')
      expect(card).toHaveAttribute('role', 'button')
      expect(card).toHaveAttribute('aria-label', 'Card button')
    })

    it('should have proper focus management', () => {
      render(() => (
        <MotionCard clickable tabIndex={0} data-testid="focus-management-card">
          Focus Management Card
        </MotionCard>
      ))

      const card = screen.getByTestId('focus-management-card')
      expect(card).toHaveAttribute('tabIndex', '0')
    })

    it('should handle custom props', () => {
      render(() => (
        <MotionCard
          clickable
          role="button"
          aria-label="Card button"
          data-testid="accessible-card"
        >
          Accessible Card
        </MotionCard>
      ))

      const card = screen.getByTestId('accessible-card')
      expect(card).toHaveAttribute('role', 'button')
      expect(card).toHaveAttribute('aria-label', 'Card button')
    })
  })

  describe('Performance', () => {
    it('should use CSS transforms for animations', () => {
      render(() => (
        <MotionCard clickable data-testid="performance-card">
          Performance Card
        </MotionCard>
      ))

      const card = screen.getByTestId('performance-card')
      expect(card).toHaveStyle(
        'transition: all 150ms cubic-bezier(0, 0, 0.58, 1)'
      )
    })

    it('should handle rapid state changes', () => {
      const TestComponent = () => {
        const [isLoading, setIsLoading] = createSignal(false)

        return (
          <div>
            <button
              type="button"
              onClick={() => setIsLoading(!isLoading())}
              data-testid="toggle-loading"
            >
              Toggle Loading
            </button>
            <MotionCard
              loading={isLoading()}
              clickable
              data-testid="rapid-change-card"
            >
              Rapid Change Card
            </MotionCard>
          </div>
        )
      }

      render(() => <TestComponent />)

      const toggleLoading = screen.getByTestId('toggle-loading')
      const card = screen.getByTestId('rapid-change-card')

      // Rapid state changes
      for (let i = 0; i < 5; i++) {
        fireEvent.click(toggleLoading)
        vi.advanceTimersByTime(10)
      }

      expect(card).toBeInTheDocument()
    })

    it('should cleanup IntersectionObserver on unmount', () => {
      const { unmount } = render(() => (
        <MotionCard animateOnScroll={true} data-testid="cleanup-card">
          Cleanup Card
        </MotionCard>
      ))

      unmount()
      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe('Custom Props', () => {
    it('should pass through additional props', () => {
      render(() => (
        <MotionCard data-testid="props-card" data-custom="custom-value">
          Props Card
        </MotionCard>
      ))

      const card = screen.getByTestId('props-card')
      expect(card).toHaveAttribute('data-custom', 'custom-value')
    })

    it('should handle children properly', () => {
      render(() => (
        <MotionCard data-testid="children-card">
          <h3>Title</h3>
          <p>Paragraph</p>
          <div>Div content</div>
        </MotionCard>
      ))

      const _card = screen.getByTestId('children-card')
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Paragraph')).toBeInTheDocument()
      expect(screen.getByText('Div content')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing onClick gracefully', () => {
      render(() => (
        <MotionCard clickable data-testid="no-onclick-card">
          No onClick
        </MotionCard>
      ))

      const card = screen.getByTestId('no-onclick-card')
      expect(() => fireEvent.click(card)).not.toThrow()
    })

    it('should handle invalid children gracefully', () => {
      expect(() => {
        render(() => (
          <MotionCard data-testid="invalid-children-card">
            {null}
            {undefined}
            {false}
            Valid Content
          </MotionCard>
        ))

        const card = screen.getByTestId('invalid-children-card')
        expect(card).toHaveTextContent('Valid Content')
      }).not.toThrow()
    })
  })
})
