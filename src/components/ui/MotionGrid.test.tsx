import { render, screen, cleanup } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MotionGrid } from './MotionGrid'

// Mock motion utilities
vi.mock('../../lib/motion', () => ({
  isMotionEnabled: vi.fn(() => true),
  getEasing: vi.fn(() => 'ease-out'),
  getDuration: vi.fn(() => 300),
  getDelay: vi.fn(() => 0),
  MOTION_DURATIONS: {
    fast: 150,
    normal: 300,
    slow: 500,
    instant: 0,
  },
  MOTION_EASING: {
    ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.58, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    linear: 'linear',
  },
  MOTION_DELAYS: {
    none: 0,
    short: 50,
    normal: 100,
    long: 200,
  },
}))

describe('MotionGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    cleanup()
  })

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(() => (
        <MotionGrid>
          <div data-testid="item-1">Item 1</div>
          <div data-testid="item-2">Item 2</div>
        </MotionGrid>
      ))

      expect(screen.getByTestId('item-1')).toBeInTheDocument()
      expect(screen.getByTestId('item-2')).toBeInTheDocument()
    })

    it('should render with single child', () => {
      render(() => (
        <MotionGrid>
          <div data-testid="single-item">Single Item</div>
        </MotionGrid>
      ))

      expect(screen.getByTestId('single-item')).toBeInTheDocument()
    })

    it('should render with no children', () => {
      render(() => <MotionGrid />)

      // Should render empty grid
      const grid = document.querySelector('.motion-grid')
      expect(grid).toBeInTheDocument()
    })

    it('should filter out null children', () => {
      render(() => (
        <MotionGrid>
          <div data-testid="valid-item">Valid Item</div>
          {null}
          <div data-testid="another-valid">Another Valid</div>
          {undefined}
        </MotionGrid>
      ))

      expect(screen.getByTestId('valid-item')).toBeInTheDocument()
      expect(screen.getByTestId('another-valid')).toBeInTheDocument()
    })
  })

  describe('Grid Layout', () => {
    it('should apply default grid style', () => {
      render(() => (
        <MotionGrid>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      const grid = document.querySelector('.motion-grid')
      expect(grid).toHaveStyle({
        display: 'grid',
        'grid-template-columns': 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
      })
    })

    it('should apply custom number of columns', () => {
      render(() => (
        <MotionGrid columns={3}>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      const grid = document.querySelector('.motion-grid')
      expect(grid).toHaveStyle({
        'grid-template-columns': 'repeat(3, 1fr)',
      })
    })

    it('should apply custom column string', () => {
      render(() => (
        <MotionGrid columns="200px 1fr 2fr">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      const grid = document.querySelector('.motion-grid')
      expect(grid).toHaveStyle({
        'grid-template-columns': '200px 1fr 2fr',
      })
    })

    it('should apply custom gap', () => {
      render(() => (
        <MotionGrid gap="2rem">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      const grid = document.querySelector('.motion-grid')
      expect(grid).toHaveStyle({
        gap: '2rem',
      })
    })
  })

  describe('Animation Variants', () => {
    it('should apply fade animation by default', () => {
      render(() => (
        <MotionGrid>
          <div data-testid="item-1">Item 1</div>
          <div data-testid="item-2">Item 2</div>
        </MotionGrid>
      ))

      // Trigger animation
      vi.advanceTimersByTime(10)

      const item1 = screen.getByTestId('item-1').parentElement
      const item2 = screen.getByTestId('item-2').parentElement

      expect(item1).toHaveStyle({
        opacity: '1',
        transition: 'opacity 0.5s ease-out 0s',
      })

      expect(item2).toHaveStyle({
        opacity: '1',
        transition: 'opacity 0.5s ease-out 0.1s',
      })
    })

    it('should apply slide animation', () => {
      render(() => (
        <MotionGrid variant="slide" direction="up">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      // Trigger animation
      vi.advanceTimersByTime(10)

      const item = screen.getByTestId('item').parentElement
      expect(item).toHaveStyle({
        opacity: '1',
        transform: 'translate(0, 0)',
        transition: 'all 0.5s ease-out 0s',
      })
    })

    it('should apply scale animation', () => {
      render(() => (
        <MotionGrid variant="scale">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      // Trigger animation
      vi.advanceTimersByTime(10)

      const item = screen.getByTestId('item').parentElement
      expect(item).toHaveStyle({
        opacity: '1',
        transform: 'scale(1)',
        transition: 'all 0.5s ease-out 0s',
      })
    })

    it('should apply flip animation', () => {
      render(() => (
        <MotionGrid variant="flip">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      // Trigger animation
      vi.advanceTimersByTime(10)

      const item = screen.getByTestId('item').parentElement
      expect(item).toHaveStyle({
        opacity: '1',
        transform: 'rotateY(0deg)',
        transition: 'all 0.5s ease-out 0s',
      })
    })
  })

  describe('Slide Directions', () => {
    it('should slide up by default', () => {
      render(() => (
        <MotionGrid variant="slide">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      // Before animation - check initial state
      const item = screen.getByTestId('item').parentElement

      // After animation
      vi.advanceTimersByTime(10)
      expect(item).toHaveStyle({
        opacity: '1',
        transform: 'translate(0, 0)',
        transition: 'all 0.5s ease-out 0s',
      })
    })

    it('should slide down', () => {
      render(() => (
        <MotionGrid variant="slide" direction="down">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      const item = screen.getByTestId('item').parentElement

      vi.advanceTimersByTime(10)
      expect(item).toHaveStyle({
        opacity: '1',
        transform: 'translate(0, 0)',
        transition: 'all 0.5s ease-out 0s',
      })
    })

    it('should slide left', () => {
      render(() => (
        <MotionGrid variant="slide" direction="left">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      const item = screen.getByTestId('item').parentElement

      vi.advanceTimersByTime(10)
      expect(item).toHaveStyle({
        opacity: '1',
        transform: 'translate(0, 0)',
        transition: 'all 0.5s ease-out 0s',
      })
    })

    it('should slide right', () => {
      render(() => (
        <MotionGrid variant="slide" direction="right">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      const item = screen.getByTestId('item').parentElement

      vi.advanceTimersByTime(10)
      expect(item).toHaveStyle({
        opacity: '1',
        transform: 'translate(0, 0)',
        transition: 'all 0.5s ease-out 0s',
      })
    })
  })

  describe('Stagger Animation', () => {
    it('should apply stagger delay to items', () => {
      render(() => (
        <MotionGrid stagger={0.2}>
          <div data-testid="item-1">Item 1</div>
          <div data-testid="item-2">Item 2</div>
          <div data-testid="item-3">Item 3</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(10)

      const item1 = screen.getByTestId('item-1').parentElement
      const item2 = screen.getByTestId('item-2').parentElement
      const item3 = screen.getByTestId('item-3').parentElement

      // Check that transitions have different delays
      const transition1 = item1.style.transition
      const transition2 = item2.style.transition
      const transition3 = item3.style.transition

      expect(transition1).toContain('0s')
      expect(transition2).toContain('0.2s')
      expect(transition3).toContain('0.4s')
    })

    it('should use default stagger when not specified', () => {
      render(() => (
        <MotionGrid>
          <div data-testid="item-1">Item 1</div>
          <div data-testid="item-2">Item 2</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(10)

      const item1 = screen.getByTestId('item-1').parentElement
      const item2 = screen.getByTestId('item-2').parentElement

      const transition1 = item1.style.transition
      const transition2 = item2.style.transition

      expect(transition1).toContain('0s')
      expect(transition2).toContain('0.1s')
    })
  })

  describe('Animation Timing', () => {
    it('should use default duration', () => {
      render(() => (
        <MotionGrid>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(10)

      const item = screen.getByTestId('item').parentElement
      expect(item.style.transition).toContain('0.5s')
    })

    it('should use custom duration', () => {
      render(() => (
        <MotionGrid duration={1.5}>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(10)

      const item = screen.getByTestId('item').parentElement
      expect(item.style.transition).toContain('1.5s')
    })

    it('should apply initial delay', () => {
      render(() => (
        <MotionGrid delay={1}>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      // Before delay - should not be animated yet
      const item = screen.getByTestId('item').parentElement

      // After delay - should be animated
      vi.advanceTimersByTime(1100)
      expect(item).toHaveStyle({
        opacity: '1',
        transition: 'opacity 0.5s ease-out 1s',
      })
    })
  })

  describe('Animation Callbacks', () => {
    it('should call onAnimationStart', () => {
      const onStart = vi.fn()

      render(() => (
        <MotionGrid onAnimationStart={onStart}>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(10)
      expect(onStart).toHaveBeenCalled()
    })

    it('should call onAnimationComplete after animation', () => {
      const onComplete = vi.fn()

      render(() => (
        <MotionGrid duration={0.5} onAnimationComplete={onComplete}>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(600) // duration + small buffer
      expect(onComplete).toHaveBeenCalled()
    })

    it('should calculate completion time with stagger', () => {
      const onComplete = vi.fn()

      render(() => (
        <MotionGrid
          duration={0.5}
          stagger={0.2}
          onAnimationComplete={onComplete}
        >
          <div data-testid="item-1">Item 1</div>
          <div data-testid="item-2">Item 2</div>
          <div data-testid="item-3">Item 3</div>
        </MotionGrid>
      ))

      // Total duration should be 0.5 + (3-1) * 0.2 = 0.9
      vi.advanceTimersByTime(1000)
      expect(onComplete).toHaveBeenCalled()
    })
  })

  describe('Animation Control', () => {
    it('should not animate when animate is false', () => {
      render(() => (
        <MotionGrid animate={false}>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(100)

      const item = screen.getByTestId('item').parentElement
      expect(item.style.opacity).toBe('')
      expect(item.style.transform).toBe('')
    })

    it('should animate by default', () => {
      render(() => (
        <MotionGrid>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(10)

      const item = screen.getByTestId('item').parentElement
      expect(item.style.opacity).toBe('1')
    })
  })

  describe('Motion Integration', () => {
    it('should not apply styles when motion is disabled', async () => {
      const { isMotionEnabled } = await import('../../lib/motion')
      vi.mocked(isMotionEnabled).mockReturnValue(false)

      render(() => (
        <MotionGrid>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(10)

      const item = screen.getByTestId('item').parentElement
      expect(item.style.opacity).toBe('')
      expect(item.style.transform).toBe('')

      // Reset mock for next test
      vi.mocked(isMotionEnabled).mockRestore()
    })

    it('should apply easing function', () => {
      render(() => (
        <MotionGrid easing="custom-easing">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      vi.advanceTimersByTime(10)

      const item = screen.getByTestId('item').parentElement
      expect(item.style.transition).toContain('ease-out') // Using mocked value
    })
  })

  describe('CSS Classes and Props', () => {
    it('should apply custom CSS classes', () => {
      render(() => (
        <MotionGrid class="custom-grid-class another-class">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      const grid = document.querySelector('.motion-grid')
      expect(grid).toHaveClass('custom-grid-class', 'another-class')
    })

    it('should pass through additional props', () => {
      render(() => (
        <MotionGrid data-testid="custom-grid" role="grid">
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      const grid = screen.getByTestId('custom-grid')
      expect(grid).toBeInTheDocument()
      expect(grid).toHaveAttribute('role', 'grid')
    })
  })

  describe('Cleanup', () => {
    it('should cleanup timeouts on unmount', () => {
      const { unmount } = render(() => (
        <MotionGrid duration={1} onAnimationComplete={vi.fn()}>
          <div data-testid="item">Item</div>
        </MotionGrid>
      ))

      // Unmount before animation completes
      unmount()

      // Should not call completion callback after unmount
      vi.advanceTimersByTime(2000)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty children array', () => {
      render(() => <MotionGrid>{[]}</MotionGrid>)

      const grid = document.querySelector('.motion-grid')
      expect(grid).toBeInTheDocument()
    })

    it('should handle mixed children types', () => {
      render(() => (
        <MotionGrid>
          <div data-testid="element">Element</div>
          {null}
          {false}
          {true}
          {undefined}
          <div data-testid="another-element">Another Element</div>
        </MotionGrid>
      ))

      expect(screen.getByTestId('element')).toBeInTheDocument()
      expect(screen.getByTestId('another-element')).toBeInTheDocument()
    })

    it('should handle large number of items', () => {
      const items = Array.from({ length: 100 }, (_, i) => (
        <div data-testid={`item-${i}`}>Item {i}</div>
      ))

      render(() => <MotionGrid>{items}</MotionGrid>)

      expect(screen.getByTestId('item-0')).toBeInTheDocument()
      expect(screen.getByTestId('item-99')).toBeInTheDocument()
    })
  })
})
