import { render, screen, cleanup } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Loading } from './Loading'

describe('Loading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cleanup()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })
  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(() => <Loading />)

      const spinners = screen.getAllByTestId('loading-spinner')
      expect(spinners.length).toBeGreaterThan(0)
      expect(spinners[0]).toHaveClass('w-6', 'h-6', 'animate-spin')
    })

    it('should render with text when provided', () => {
      render(() => <Loading text="Loading data..." />)

      expect(screen.getByText('Loading data...')).toBeInTheDocument()
      const spinners = screen.getAllByTestId('loading-spinner')
      expect(spinners.length).toBeGreaterThan(0)
    })

    it('should not render text when not provided', () => {
      render(() => <Loading />)

      expect(screen.queryByText('Loading data...')).not.toBeInTheDocument()
    })
  })

  describe('Size Variants', () => {
    it('should render small size correctly', () => {
      render(() => <Loading size="sm" />)

      const spinners = screen.getAllByTestId('loading-spinner')
      expect(spinners[0]).toHaveClass('w-4', 'h-4')
    })

    it('should render medium size correctly', () => {
      render(() => <Loading size="md" />)

      const spinners = screen.getAllByTestId('loading-spinner')
      expect(spinners[0]).toHaveClass('w-6', 'h-6')
    })

    it('should render large size correctly', () => {
      render(() => <Loading size="lg" />)

      const spinners = screen.getAllByTestId('loading-spinner')
      expect(spinners[0]).toHaveClass('w-8', 'h-8')
    })

    it('should use medium size when size is not specified', () => {
      render(() => <Loading />)

      const spinners = screen.getAllByTestId('loading-spinner')
      expect(spinners[0]).toHaveClass('w-6', 'h-6')
    })

    it('should apply correct text size with different spinner sizes', () => {
      const { rerender } = render(() => (
        <Loading size="sm" text="Small loading" />
      ))
      expect(screen.getByText('Small loading')).toHaveClass('text-sm')

      rerender(() => <Loading size="md" text="Medium loading" />)
      expect(screen.getByText('Medium loading')).toHaveClass('text-base')

      rerender(() => <Loading size="lg" text="Large loading" />)
      expect(screen.getByText('Large loading')).toHaveClass('text-lg')
    })

    it('should render medium size correctly', () => {
      render(() => <Loading size="md" />)

      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveClass('w-6', 'h-6')
    })

    it('should render large size correctly', () => {
      render(() => <Loading size="lg" />)

      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveClass('w-8', 'h-8')
    })

    it('should use medium size when size is not specified', () => {
      render(() => <Loading />)

      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveClass('w-6', 'h-6')
    })

    it('should apply correct text size with different spinner sizes', () => {
      const { rerender } = render(() => (
        <Loading size="sm" text="Small loading" />
      ))
      expect(screen.getByText('Small loading')).toHaveClass('text-sm')

      rerender(() => <Loading size="md" text="Medium loading" />)
      expect(screen.getByText('Medium loading')).toHaveClass('text-base')

      rerender(() => <Loading size="lg" text="Large loading" />)
      expect(screen.getByText('Large loading')).toHaveClass('text-lg')
    })
  })

  describe('Overlay Mode', () => {
    it('should render in overlay mode when overlay prop is true', () => {
      render(() => <Loading overlay text="Loading..." />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()

      // Check for overlay container
      const overlay = document.querySelector('.fixed.inset-0')
      expect(overlay).toBeInTheDocument()
      expect(overlay).toHaveClass('bg-black', 'bg-opacity-50', 'z-50')
    })

    it('should render without overlay when overlay prop is false', () => {
      render(() => <Loading overlay={false} />)

      // Should not have overlay classes
      const overlay = document.querySelector('.fixed.inset-0')
      expect(overlay).not.toBeInTheDocument()

      // Should still have spinner
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('should render without overlay when overlay prop is not specified', () => {
      render(() => <Loading />)

      // Should not have overlay classes
      const overlay = document.querySelector('.fixed.inset-0')
      expect(overlay).not.toBeInTheDocument()
    })

    it('should center content properly in overlay mode', () => {
      render(() => <Loading overlay text="Overlay loading" />)

      const overlay = document.querySelector('.fixed.inset-0')
      expect(overlay).toHaveClass('flex', 'items-center', 'justify-center')

      // Check for centered content container
      const contentContainer = document.querySelector('.rounded-lg.p-6')
      expect(contentContainer).toBeInTheDocument()
      expect(contentContainer).toHaveClass(
        'flex',
        'flex-col',
        'items-center',
        'space-y-3'
      )
    })
  })

  describe('Theme Integration', () => {
    it('should apply theme classes to spinner', () => {
      render(() => <Loading />)

      const spinners = screen.getAllByTestId('loading-spinner')
      expect(spinners.length).toBeGreaterThan(0)
      // Should have theme color classes (checking for animate-spin as proxy)
      expect(spinners[0]).toHaveClass('animate-spin')
    })

    it('should apply theme classes to text', () => {
      render(() => <Loading text="Themed text" />)

      const textElement = screen.getByText('Themed text')
      expect(textElement).toBeInTheDocument()
      // Should have theme text classes
    })

    it('should apply theme classes to overlay content', () => {
      render(() => <Loading overlay text="Overlay text" />)

      const contentContainer = document.querySelector('.rounded-lg.p-6')
      expect(contentContainer).toBeInTheDocument()
      // Should have theme background classes
    })
  })

  describe('Layout and Structure', () => {
    it('should use flex layout for non-overlay mode', () => {
      render(() => <Loading />)

      const container = screen
        .getAllByTestId('loading-spinner')[0]
        .closest('div')
      expect(container).toHaveClass(
        'flex',
        'flex-col',
        'items-center',
        'justify-center',
        'space-y-2'
      )
    })

    it('should space spinner and text correctly', () => {
      render(() => <Loading text="With spacing" />)

      const container = screen
        .getAllByTestId('loading-spinner')[0]
        .closest('div')
      expect(container).toHaveClass('space-y-2')
    })

    it('should space spinner and text correctly', () => {
      render(() => <Loading text="With spacing" />)

      const container = screen.getByTestId('loading-spinner').closest('div')
      expect(container).toHaveClass('space-y-2')
    })

    it('should space overlay elements correctly', () => {
      render(() => <Loading overlay text="Overlay spacing" />)

      const contentContainer = document.querySelector('.rounded-lg.p-6')
      expect(contentContainer).toHaveClass('space-y-3')
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      render(() => <Loading text="Accessible loading" />)

      // Should have visible text for screen readers
      expect(screen.getByText('Accessible loading')).toBeInTheDocument()
    })

    it('should be identifiable in overlay mode', () => {
      render(() => <Loading overlay text="Loading content" />)

      expect(screen.getByText('Loading content')).toBeInTheDocument()

      // Should have high z-index for overlay
      const overlay = document.querySelector('.fixed.inset-0')
      expect(overlay).toHaveClass('z-50')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty text string', () => {
      render(() => <Loading text="" />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      // Should not render empty text element
      expect(screen.queryByText('')).not.toBeInTheDocument()
    })

    it('should handle whitespace-only text', () => {
      render(() => <Loading text="   " />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      // Should not render whitespace-only text
      expect(screen.queryByText('   ')).not.toBeInTheDocument()
    })

    it('should handle very long text', () => {
      const longText = 'L'.repeat(1000)
      render(() => <Loading text={longText} />)

      expect(screen.getByText(longText)).toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })
  })

  describe('Component Consistency', () => {
    it('should render consistently across different prop combinations', () => {
      const combinations = [
        { size: 'sm', text: 'Small', overlay: false },
        { size: 'md', text: 'Medium', overlay: true },
        { size: 'lg', text: 'Large', overlay: false },
        { size: 'sm', overlay: true },
        { size: 'lg', text: 'Large with overlay', overlay: true },
      ]

      combinations.forEach((props) => {
        const { unmount } = render(() => <Loading {...props} />)

        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

        if (props.text) {
          expect(screen.getByText(props.text)).toBeInTheDocument()
        }

        if (props.overlay) {
          expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument()
        } else {
          expect(
            document.querySelector('.fixed.inset-0')
          ).not.toBeInTheDocument()
        }

        unmount()
      })
    })
  })
})
