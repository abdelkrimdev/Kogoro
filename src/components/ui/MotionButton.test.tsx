/**
 * MotionButton Component Tests
 * Tests the animated button component with all its variants and states
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/solidjs/web'
import { createSignal } from 'solid-js'
import { MotionButton } from './MotionButton'

// Mock requestAnimationFrame for animation testing
const mockRequestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
const mockCancelAnimationFrame = vi.fn()
window.requestAnimationFrame = mockRequestAnimationFrame
window.cancelAnimationFrame = mockCancelAnimationFrame

describe('MotionButton', () => {
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
        <MotionButton data-testid="motion-button">Test Button</MotionButton>
      ))

      const button = screen.getByTestId('motion-button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Test Button')
      expect(button).toHaveClass(
        'bg-blue-600',
        'hover:bg-blue-700',
        'text-white'
      )
    })

    it('should render with different variants', () => {
      const variants = ['primary', 'secondary', 'ghost', 'danger'] as const

      variants.forEach((variant) => {
        cleanup()
        render(() => (
          <MotionButton variant={variant} data-testid={`button-${variant}`}>
            {variant} Button
          </MotionButton>
        ))

        const button = screen.getByTestId(`button-${variant}`)
        expect(button).toBeInTheDocument()
        expect(button).toHaveTextContent(`${variant} Button`)
      })
    })

    it('should render with different sizes', () => {
      const sizes = ['sm', 'md', 'lg'] as const

      sizes.forEach((size) => {
        cleanup()
        render(() => (
          <MotionButton size={size} data-testid={`button-${size}`}>
            {size} Button
          </MotionButton>
        ))

        const button = screen.getByTestId(`button-${size}`)
        expect(button).toBeInTheDocument()

        const sizeClasses = {
          sm: 'px-3 py-1.5 text-sm',
          md: 'px-4 py-2 text-sm',
          lg: 'px-6 py-3 text-base',
        }

        expect(button).toHaveClass(sizeClasses[size])
      })
    })

    it('should render with icons', () => {
      render(() => (
        <div>
          <MotionButton icon="🚀" data-testid="button-left-icon">
            Left Icon
          </MotionButton>
          <MotionButton
            icon="⭐"
            iconPosition="right"
            data-testid="button-right-icon"
          >
            Right Icon
          </MotionButton>
        </div>
      ))

      const leftButton = screen.getByTestId('button-left-icon')
      const rightButton = screen.getByTestId('button-right-icon')

      expect(leftButton).toBeInTheDocument()
      expect(leftButton).toHaveTextContent('🚀 Left Icon')

      expect(rightButton).toBeInTheDocument()
      expect(rightButton).toHaveTextContent('Right Icon ⭐')
    })

    it('should render as full width', () => {
      render(() => (
        <MotionButton fullWidth data-testid="full-width-button">
          Full Width
        </MotionButton>
      ))

      const button = screen.getByTestId('full-width-button')
      expect(button).toHaveClass('w-full')
    })
  })

  describe('Interaction Animations', () => {
    it('should handle hover animations', () => {
      render(() => (
        <MotionButton data-testid="hover-button">Hover Me</MotionButton>
      ))

      const button = screen.getByTestId('hover-button')

      // Initial state
      expect(button).toHaveStyle('transform: scale(1)')

      // Hover state
      fireEvent.mouseEnter(button)
      expect(button).toHaveStyle('transform: scale(1.05)')

      // Leave hover
      fireEvent.mouseLeave(button)
      expect(button).toHaveStyle('transform: scale(1)')
    })

    it('should handle press animations', () => {
      render(() => (
        <MotionButton data-testid="press-button">Press Me</MotionButton>
      ))

      const button = screen.getByTestId('press-button')

      // Mouse down
      fireEvent.mouseDown(button)
      expect(button).toHaveStyle('transform: scale(0.95)')

      // Mouse up
      fireEvent.mouseUp(button)
      expect(button).toHaveStyle('transform: scale(1)')
    })

    it('should handle focus animations', () => {
      render(() => (
        <MotionButton data-testid="focus-button">Focus Me</MotionButton>
      ))

      const button = screen.getByTestId('focus-button')

      // Focus
      fireEvent.focus(button)
      expect(button).toHaveStyle('transform: scale(1.02)')

      // Blur
      fireEvent.blur(button)
      expect(button).toHaveStyle('transform: scale(1)')
    })

    it('should handle keyboard interactions', () => {
      render(() => (
        <MotionButton data-testid="keyboard-button">
          Keyboard Button
        </MotionButton>
      ))

      const button = screen.getByTestId('keyboard-button')

      // Enter key
      fireEvent.keyDown(button, { key: 'Enter' })
      expect(button).toHaveStyle('transform: scale(0.95)')

      fireEvent.keyUp(button, { key: 'Enter' })
      expect(button).toHaveStyle('transform: scale(1)')

      // Space key
      fireEvent.keyDown(button, { key: ' ' })
      expect(button).toHaveStyle('transform: scale(0.95)')

      fireEvent.keyUp(button, { key: ' ' })
      expect(button).toHaveStyle('transform: scale(1)')
    })
  })

  describe('Loading State', () => {
    it('should show loading state', () => {
      render(() => (
        <MotionButton loading data-testid="loading-button">
          Loading Button
        </MotionButton>
      ))

      const button = screen.getByTestId('loading-button')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(button).not.toHaveTextContent('Loading Button')
    })

    it('should show loading text', () => {
      render(() => (
        <MotionButton
          loading
          loadingText="Processing..."
          data-testid="loading-text-button"
        >
          Original Text
        </MotionButton>
      ))

      const button = screen.getByTestId('loading-text-button')
      expect(screen.getByText('Processing...')).toBeInTheDocument()
      expect(button).not.toHaveTextContent('Original Text')
    })

    it('should not be interactive when loading', () => {
      const handleClick = vi.fn()
      render(() => (
        <MotionButton
          loading
          onClick={handleClick}
          data-testid="loading-interactive-button"
        >
          Loading Button
        </MotionButton>
      ))

      const button = screen.getByTestId('loading-interactive-button')

      fireEvent.click(button)
      fireEvent.mouseEnter(button)
      fireEvent.mouseDown(button)

      expect(handleClick).not.toHaveBeenCalled()
      expect(button).toHaveStyle('cursor: not-allowed')
    })
  })

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(() => (
        <MotionButton disabled data-testid="disabled-button">
          Disabled Button
        </MotionButton>
      ))

      const button = screen.getByTestId('disabled-button')
      expect(button).toBeDisabled()
      expect(button).toHaveStyle('opacity: 0.5')
      expect(button).toHaveStyle('cursor: not-allowed')
    })

    it('should not respond to interactions when disabled', () => {
      const handleClick = vi.fn()
      render(() => (
        <MotionButton
          disabled
          onClick={handleClick}
          data-testid="disabled-interactive-button"
        >
          Disabled Button
        </MotionButton>
      ))

      const button = screen.getByTestId('disabled-interactive-button')

      fireEvent.click(button)
      fireEvent.mouseEnter(button)
      fireEvent.mouseDown(button)
      fireEvent.focus(button)

      expect(handleClick).not.toHaveBeenCalled()
      expect(button).toHaveStyle('transform: scale(1)')
    })
  })

  describe('Click Handling', () => {
    it('should call onClick handler', () => {
      const handleClick = vi.fn()
      render(() => (
        <MotionButton onClick={handleClick} data-testid="click-button">
          Click Me
        </MotionButton>
      ))

      const button = screen.getByTestId('click-button')
      fireEvent.click(button)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(() => (
        <MotionButton
          disabled
          onClick={handleClick}
          data-testid="disabled-click-button"
        >
          Disabled Click
        </MotionButton>
      ))

      const button = screen.getByTestId('disabled-click-button')
      fireEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when loading', () => {
      const handleClick = vi.fn()
      render(() => (
        <MotionButton
          loading
          onClick={handleClick}
          data-testid="loading-click-button"
        >
          Loading Click
        </MotionButton>
      ))

      const button = screen.getByTestId('loading-click-button')
      fireEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes when loading', () => {
      render(() => (
        <MotionButton
          loading
          loadingText="Loading data..."
          data-testid="accessible-loading-button"
        >
          Load Data
        </MotionButton>
      ))

      const button = screen.getByTestId('accessible-loading-button')
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(button).toHaveAttribute('aria-label', 'Loading data...')
    })

    it('should have proper button type', () => {
      render(() => (
        <div>
          <MotionButton type="submit" data-testid="submit-button">
            Submit
          </MotionButton>
          <MotionButton type="reset" data-testid="reset-button">
            Reset
          </MotionButton>
          <MotionButton type="button" data-testid="button-type-button">
            Button
          </MotionButton>
        </div>
      ))

      expect(screen.getByTestId('submit-button')).toHaveAttribute(
        'type',
        'submit'
      )
      expect(screen.getByTestId('reset-button')).toHaveAttribute(
        'type',
        'reset'
      )
      expect(screen.getByTestId('button-type-button')).toHaveAttribute(
        'type',
        'button'
      )
    })

    it('should have focus styles', () => {
      render(() => (
        <MotionButton data-testid="focus-style-button">
          Focus Style
        </MotionButton>
      ))

      const button = screen.getByTestId('focus-style-button')
      expect(button).toHaveClass(
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-offset-2',
        'focus:ring-blue-500'
      )
    })
  })

  describe('Animation Performance', () => {
    it('should use CSS transitions for animations', () => {
      render(() => (
        <MotionButton data-testid="performance-button">
          Performance Test
        </MotionButton>
      ))

      const button = screen.getByTestId('performance-button')
      const _style = window.getComputedStyle(button)

      // Should have transition styles
      expect(button).toHaveStyle(
        'transition: all 150ms cubic-bezier(0, 0, 0.58, 1)'
      )
    })

    it('should handle rapid state changes', () => {
      const TestComponent = () => {
        const [isLoading, setIsLoading] = createSignal(false)
        const [isDisabled, setIsDisabled] = createSignal(false)

        return (
          <div>
            <button
              type="button"
              onClick={() => setIsLoading(!isLoading())}
              data-testid="toggle-loading"
            >
              Toggle Loading
            </button>
            <button
              type="button"
              onClick={() => setIsDisabled(!isDisabled())}
              data-testid="toggle-disabled"
            >
              Toggle Disabled
            </button>
            <MotionButton
              loading={isLoading()}
              disabled={isDisabled()}
              data-testid="rapid-change-button"
            >
              Rapid Change
            </MotionButton>
          </div>
        )
      }

      render(() => <TestComponent />)

      const toggleLoading = screen.getByTestId('toggle-loading')
      const toggleDisabled = screen.getByTestId('toggle-disabled')
      const button = screen.getByTestId('rapid-change-button')

      // Rapid state changes
      for (let i = 0; i < 5; i++) {
        fireEvent.click(toggleLoading)
        fireEvent.click(toggleDisabled)
        vi.advanceTimersByTime(10)
      }

      expect(button).toBeInTheDocument()
    })
  })

  describe('Custom Classes and Props', () => {
    it('should accept custom CSS classes', () => {
      render(() => (
        <MotionButton
          class="custom-class another-class"
          data-testid="custom-class-button"
        >
          Custom Classes
        </MotionButton>
      ))

      const button = screen.getByTestId('custom-class-button')
      expect(button).toHaveClass('custom-class', 'another-class')
    })

    it('should pass through additional props', () => {
      render(() => (
        <MotionButton
          data-testid="props-button"
          data-custom="custom-value"
          title="Button title"
        >
          Props Test
        </MotionButton>
      ))

      const button = screen.getByTestId('props-button')
      expect(button).toHaveAttribute('data-custom', 'custom-value')
      expect(button).toHaveAttribute('title', 'Button title')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing onClick gracefully', () => {
      expect(() => {
        render(() => (
          <MotionButton data-testid="no-onclick-button">
            No onClick
          </MotionButton>
        ))

        const button = screen.getByTestId('no-onclick-button')
        fireEvent.click(button)
      }).not.toThrow()
    })

    it('should handle invalid children gracefully', () => {
      expect(() => {
        render(() => (
          <MotionButton data-testid="invalid-children-button">
            {null}
            {undefined}
            {false}
            Valid Content
          </MotionButton>
        ))

        const button = screen.getByTestId('invalid-children-button')
        expect(button).toHaveTextContent('Valid Content')
      }).not.toThrow()
    })
  })
})
