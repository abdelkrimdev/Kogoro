/**
 * Tests for MotionPresence component
 * Verifies enter/exit animations and state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@solidjs/testing-library'
import { MotionPresence } from './MotionPresence'

// Mock motion system
vi.mock('../../lib/motion', () => ({
  isMotionEnabled: () => true,
  getDuration: () => 300,
  getEasing: () => 'ease',
  getDelay: () => 0,
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

// Mock motion-variants
vi.mock('../../lib/motion-variants', () => ({
  createVariants: vi.fn(),
  getVariant: vi.fn(),
  MOTION_VARIANTS: {
    fade: {
      enter: 'animate-fade-in',
      exit: 'animate-fade-out',
    },
    slide: {
      enter: 'animate-slide-in',
      exit: 'animate-slide-out',
    },
    scale: {
      enter: 'animate-scale-in',
      exit: 'animate-scale-out',
    },
  },
}))

describe('MotionPresence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('should not render when show is false', () => {
      const { unmount } = render(() => (
        <MotionPresence show={false}>
          <div data-testid="content">Content</div>
        </MotionPresence>
      ))

      expect(screen.queryByTestId('content')).not.toBeInTheDocument()
      unmount()
    })

    it('should render when show is true', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true}>
          <div data-testid="content">Content</div>
        </MotionPresence>
      ))

      expect(screen.getByTestId('content')).toBeInTheDocument()
      unmount()
    })

    it('should render children content', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true}>
          <div data-testid="content">Content</div>
        </MotionPresence>
      ))

      expect(screen.getByTestId('content')).toHaveTextContent('Content')
      unmount()
    })

    it('should handle empty children', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true}>
          <div data-testid="empty-content"></div>
        </MotionPresence>
      ))

      expect(screen.getByTestId('empty-content')).toBeInTheDocument()
      unmount()
    })
  })

  describe('Animation Variants', () => {
    it('should apply fade animation by default', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true}>
          <div data-testid="fade-content">Fade Content</div>
        </MotionPresence>
      ))

      const element = screen.getByTestId('fade-content')
      expect(element).toBeInTheDocument()
      expect(element.parentElement).toHaveClass('motion-presence-content')
      unmount()
    })

    it('should apply slide variant', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true} variant="slide">
          <div data-testid="slide-content">Slide Content</div>
        </MotionPresence>
      ))

      const element = screen.getByTestId('slide-content')
      expect(element).toBeInTheDocument()
      expect(element.parentElement).toHaveClass('motion-presence-content')
      unmount()
    })

    it('should apply scale variant', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true} variant="scale">
          <div data-testid="scale-content">Scale Content</div>
        </MotionPresence>
      ))

      const element = screen.getByTestId('scale-content')
      expect(element).toBeInTheDocument()
      expect(element.parentElement).toHaveClass('motion-presence-content')
      unmount()
    })
  })

  describe('Duration and Timing', () => {
    it('should use normal duration by default', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true}>
          <div data-testid="duration-content">Duration Content</div>
        </MotionPresence>
      ))

      const element = screen.getByTestId('duration-content')
      expect(element).toBeInTheDocument()
      expect(element.parentElement).toHaveStyle({
        'animation-duration': '300ms',
      })
      unmount()
    })

    it('should use fast duration', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true} duration="fast">
          <div data-testid="fast-content">Fast Content</div>
        </MotionPresence>
      ))

      const element = screen.getByTestId('fast-content')
      expect(element).toBeInTheDocument()
      expect(element.parentElement).toHaveStyle({
        'animation-duration': '200ms',
      })
      unmount()
    })

    it('should use slow duration', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true} duration="slow">
          <div data-testid="slow-content">Slow Content</div>
        </MotionPresence>
      ))

      const element = screen.getByTestId('slow-content')
      expect(element).toBeInTheDocument()
      expect(element.parentElement).toHaveStyle({
        'animation-duration': '500ms',
      })
      unmount()
    })
  })

  describe('Props and Attributes', () => {
    it('should pass through additional props', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true} data-testid="presence" role="region">
          <div data-testid="props-content">Props Content</div>
        </MotionPresence>
      ))

      expect(screen.getByTestId('presence')).toBeInTheDocument()
      expect(screen.getByTestId('presence')).toHaveAttribute('role', 'region')
      unmount()
    })

    it('should apply custom className', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true} class="custom-class">
          <div data-testid="class-content">Class Content</div>
        </MotionPresence>
      ))

      const element = screen.getByTestId('class-content')
      expect(element.parentElement).toHaveClass('custom-class')
      unmount()
    })

    it('should set animation-fill-mode to both', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true}>
          <div data-testid="fill-content">Fill Content</div>
        </MotionPresence>
      ))

      const element = screen.getByTestId('fill-content')
      expect(element.parentElement).toHaveStyle({
        'animation-fill-mode': 'both',
      })
      unmount()
    })
  })

  describe('Edge Cases', () => {
    it('should handle null children', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true}>{null}</MotionPresence>
      ))

      // Should render without crashing
      unmount()
    })

    it('should handle complex children', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true}>
          <div data-testid="complex-content">
            <span>Complex</span>
            <p>Children</p>
          </div>
        </MotionPresence>
      ))

      expect(screen.getByTestId('complex-content')).toBeInTheDocument()
      expect(screen.getByText('Complex')).toBeInTheDocument()
      expect(screen.getByText('Children')).toBeInTheDocument()
      unmount()
    })

    it('should handle missing onComplete gracefully', () => {
      const { unmount } = render(() => (
        <MotionPresence show={true}>
          <div data-testid="complete-content">Complete Content</div>
        </MotionPresence>
      ))

      expect(screen.getByTestId('complete-content')).toBeInTheDocument()
      unmount()
    })
  })
})
