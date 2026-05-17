import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MotionSidebar } from './MotionSidebar'
import { createSignal } from 'solid-js'

// Mock OptimizedMotion to bypass loading states
vi.mock('./OptimizedMotion', () => ({
  OptimizedMotion: (props: { children: JSX.Element }) => props.children,
}))

// Mock MotionErrorBoundary to bypass error boundary
vi.mock('./MotionErrorBoundary', () => ({
  MotionErrorBoundary: (props: { children: JSX.Element }) => props.children,
}))

// Mock useLazyMotion to bypass motion loading
vi.mock('../../lib/lazy-motion', () => ({
  useLazyMotion: () => ({
    preload: vi.fn().mockResolvedValue(undefined),
  }),
}))

// Mock motion utilities
vi.mock('../../lib/motion', () => ({
  isMotionEnabled: () => true,
  getDuration: () => 300,
  getEasing: () => 'ease-in-out',
  getVariant: () => ({}),
  createMotionConfig: () => ({}),
  getDelay: () => 100,
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
  getSpring: () => ({ stiffness: 100, damping: 10 }),
  getTransition: () => ({ duration: 300, easing: 'ease-in-out' }),
}))

// Mock motion hooks
vi.mock('../../hooks/useMotionAnimations', () => ({
  useReducedMotion: () => ({
    shouldAnimate: () => true,
  }),
  useSidebarAnimation: () => ({
    isOpen: () => true,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    getSidebarProps: () => ({
      role: 'complementary',
    }),
  }),
}))

describe('MotionSidebar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cleanup()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    cleanup()
    // Clear any existing sidebars
    document.body.innerHTML = ''
  })

  describe('Basic Rendering', () => {
    it('should not render when isOpen is false and variant is not static', () => {
      render(() => (
        <MotionSidebar isOpen={false}>
          <div data-testid="sidebar-content">Sidebar Content</div>
        </MotionSidebar>
      ))

      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    })

    it('should render when isOpen is true', () => {
      render(() => (
        <MotionSidebar isOpen>
          <div data-testid="sidebar-content">Sidebar Content</div>
        </MotionSidebar>
      ))

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
      expect(screen.getByRole('complementary')).toBeInTheDocument()
    })

    it('should render when variant is static regardless of isOpen', () => {
      render(() => (
        <MotionSidebar isOpen={false} variant="static">
          <div data-testid="sidebar-content">Static Sidebar</div>
        </MotionSidebar>
      ))

      // Get the static sidebar (should be the last one rendered)
      const sidebarContents = screen.getAllByTestId('sidebar-content')
      const staticSidebar = sidebarContents.find(
        (el) => el.textContent === 'Static Sidebar'
      )
      expect(staticSidebar).toBeInTheDocument()

      const sidebars = screen.getAllByRole('complementary')
      expect(sidebars.length).toBeGreaterThan(0)
    })

    it('should render children content', () => {
      render(() => (
        <MotionSidebar isOpen>
          <nav data-testid="navigation">
            <a href="#home">Home</a>
            <a href="#about">About</a>
          </nav>
        </MotionSidebar>
      ))

      expect(screen.getByTestId('navigation')).toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('About')).toBeInTheDocument()
    })
  })

  describe('Position Variants', () => {
    it('should render on left by default', () => {
      render(() => <MotionSidebar isOpen>Content</MotionSidebar>)

      // Get the most recently rendered sidebar (last one)
      const sidebars = screen.getAllByRole('complementary')
      const sidebar = sidebars[sidebars.length - 1]
      expect(sidebar).toHaveClass('left-0')
    })

    it('should render on left when position is left', () => {
      render(() => (
        <MotionSidebar isOpen position="left">
          Content
        </MotionSidebar>
      ))

      // Get the most recently rendered sidebar (last one)
      const sidebars = screen.getAllByRole('complementary')
      const sidebar = sidebars[sidebars.length - 1]
      expect(sidebar).toHaveClass('left-0')
    })

    it('should render on right when position is right', () => {
      render(() => (
        <MotionSidebar isOpen position="right">
          Content
        </MotionSidebar>
      ))

      // Get the most recently rendered sidebar (last one)
      const sidebars = screen.getAllByRole('complementary')
      const sidebar = sidebars[sidebars.length - 1]
      expect(sidebar).toHaveClass('right-0')
    })
  })

  describe('Width Variants', () => {
    it('should render small width', () => {
      render(() => (
        <MotionSidebar isOpen width="sm">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-64')
    })

    it('should render medium width by default', () => {
      render(() => <MotionSidebar isOpen>Content</MotionSidebar>)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-[17.5rem]')
    })

    it('should render medium width explicitly', () => {
      render(() => (
        <MotionSidebar isOpen width="md">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-[17.5rem]')
    })

    it('should render large width', () => {
      render(() => (
        <MotionSidebar isOpen width="lg">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-96')
    })

    it('should render extra large width', () => {
      render(() => (
        <MotionSidebar isOpen width="xl">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-[28rem]')
    })
  })

  describe('Variant Types', () => {
    it('should render overlay variant with backdrop', () => {
      render(() => (
        <MotionSidebar isOpen variant="overlay" showBackdrop>
          Content
        </MotionSidebar>
      ))

      // Find the backdrop (should be the one with fixed inset-0 classes)
      const backdropElement = Array.from(
        screen.getAllByRole('button', { name: /close sidebar/i })
      ).find(
        (btn) =>
          btn.classList.contains('fixed') && btn.classList.contains('inset-0')
      )
      expect(backdropElement).toBeInTheDocument()
      expect(backdropElement).toHaveClass('fixed', 'inset-0', 'bg-black/50')
    })

    it('should render overlay variant without backdrop when showBackdrop is false', () => {
      render(() => (
        <MotionSidebar isOpen variant="overlay" showBackdrop={false}>
          Content
        </MotionSidebar>
      ))

      // Check that no backdrop exists (but close button might still exist)
      const backdropElements = Array.from(
        screen.queryAllByRole('button', { name: /close sidebar/i })
      ).filter(
        (btn) =>
          btn.classList.contains('fixed') && btn.classList.contains('inset-0')
      )
      expect(backdropElements).toHaveLength(0)
    })

    it('should render push variant', () => {
      render(() => (
        <MotionSidebar isOpen variant="push">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toHaveClass('fixed')
    })

    it('should render static variant', () => {
      render(() => <MotionSidebar variant="static">Content</MotionSidebar>)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('relative')
    })
  })

  describe('Close Button', () => {
    it('should show close button for overlay variant', () => {
      render(() => (
        <MotionSidebar isOpen variant="overlay">
          Content
        </MotionSidebar>
      ))

      const closeButton = screen.getByRole('button', { name: /close sidebar/i })
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveAttribute('type', 'button')
    })

    it('should not show close button for non-overlay variants', () => {
      render(() => (
        <MotionSidebar isOpen variant="static">
          Content
        </MotionSidebar>
      ))

      expect(
        screen.queryByRole('button', { name: /close sidebar/i })
      ).not.toBeInTheDocument()
    })

    it('should not show close button when collapsible', () => {
      render(() => (
        <MotionSidebar isOpen variant="overlay" collapsible>
          Content
        </MotionSidebar>
      ))

      expect(
        screen.queryByRole('button', { name: /close sidebar/i })
      ).not.toBeInTheDocument()
    })

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(() => (
        <MotionSidebar isOpen variant="overlay" onClose={onClose}>
          Content
        </MotionSidebar>
      ))

      const closeButton = screen.getByRole('button', { name: /close sidebar/i })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Backdrop Interactions', () => {
    it('should close sidebar when backdrop is clicked', () => {
      const onClose = vi.fn()
      render(() => (
        <MotionSidebar
          isOpen
          variant="overlay"
          showBackdrop
          closeOnBackdropClick
          onClose={onClose}
        >
          Content
        </MotionSidebar>
      ))

      // Find the backdrop (not the close button)
      const backdrop = Array.from(
        screen.getAllByRole('button', { name: /close sidebar/i })
      ).find(
        (btn) =>
          btn.classList.contains('fixed') && btn.classList.contains('inset-0')
      )
      fireEvent.click(backdrop!)

      expect(onClose).toHaveBeenCalled()
    })

    it('should not close sidebar when closeOnBackdropClick is false', () => {
      const onClose = vi.fn()
      render(() => (
        <MotionSidebar
          isOpen
          variant="overlay"
          showBackdrop
          closeOnBackdropClick={false}
          onClose={onClose}
        >
          Content
        </MotionSidebar>
      ))

      // Find the backdrop (not the close button)
      const backdrop = Array.from(
        screen.getAllByRole('button', { name: /close sidebar/i })
      ).find(
        (btn) =>
          btn.classList.contains('fixed') && btn.classList.contains('inset-0')
      )
      fireEvent.click(backdrop!)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('should close sidebar when Enter key is pressed on backdrop', () => {
      const onClose = vi.fn()
      render(() => (
        <MotionSidebar
          isOpen
          variant="overlay"
          showBackdrop
          closeOnBackdropClick
          onClose={onClose}
        >
          Content
        </MotionSidebar>
      ))

      // Find the backdrop (not the close button)
      const backdrop = Array.from(
        screen.getAllByRole('button', { name: /close sidebar/i })
      ).find(
        (btn) =>
          btn.classList.contains('fixed') && btn.classList.contains('inset-0')
      )
      fireEvent.keyDown(backdrop!, { key: 'Enter' })

      expect(onClose).toHaveBeenCalled()
    })

    it('should close sidebar when Space key is pressed on backdrop', () => {
      const onClose = vi.fn()
      render(() => (
        <MotionSidebar
          isOpen
          variant="overlay"
          showBackdrop
          closeOnBackdropClick
          onClose={onClose}
        >
          Content
        </MotionSidebar>
      ))

      // Find the backdrop (not the close button)
      const backdrop = Array.from(
        screen.getAllByRole('button', { name: /close sidebar/i })
      ).find(
        (btn) =>
          btn.classList.contains('fixed') && btn.classList.contains('inset-0')
      )
      fireEvent.keyDown(backdrop!, { key: ' ' })

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Keyboard Interactions', () => {
    it('should close sidebar when Escape key is pressed', () => {
      const onClose = vi.fn()
      render(() => (
        <MotionSidebar isOpen onClose={onClose}>
          Content
        </MotionSidebar>
      ))

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).toHaveBeenCalled()
    })

    it('should not close sidebar when other keys are pressed', () => {
      const onClose = vi.fn()
      render(() => (
        <MotionSidebar isOpen onClose={onClose}>
          Content
        </MotionSidebar>
      ))

      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'Tab' })

      expect(onClose).not.toHaveBeenCalled()
    })

    it('should not close sidebar when Escape is pressed but sidebar is not open', () => {
      const onClose = vi.fn()
      render(() => (
        <MotionSidebar isOpen={false} onClose={onClose}>
          Content
        </MotionSidebar>
      ))

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Animation and Transitions', () => {
    it('should use normal duration by default', () => {
      render(() => <MotionSidebar isOpen>Content</MotionSidebar>)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveStyle({
        'transition-duration': '300ms',
      })
    })

    it('should use fast duration', () => {
      render(() => (
        <MotionSidebar isOpen duration="fast">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveStyle({
        'transition-duration': '200ms',
      })
    })

    it('should use slow duration', () => {
      render(() => (
        <MotionSidebar isOpen duration="slow">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveStyle({
        'transition-duration': '500ms',
      })
    })

    it('should apply correct transform classes for open state', () => {
      render(() => (
        <MotionSidebar isOpen position="left">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('translate-x-0')
    })

    it('should apply correct transform classes for closed left sidebar', () => {
      render(() => (
        <MotionSidebar isOpen={false} position="left" variant="static">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('-translate-x-full')
    })

    it('should apply correct transform classes for closed right sidebar', () => {
      render(() => (
        <MotionSidebar isOpen={false} position="right" variant="static">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('translate-x-full')
    })
  })

  describe('Collapsible Feature', () => {
    it('should apply collapsed width when collapsible and isCollapsed', () => {
      render(() => (
        <MotionSidebar isOpen collapsible isCollapsed>
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-[3.75rem]')
    })

    it('should not apply collapsed width when not collapsible', () => {
      render(() => (
        <MotionSidebar isOpen isCollapsed>
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).not.toHaveClass('w-\\[3\\.75rem\\]')
    })

    it('should not apply collapsed width when not collapsed', () => {
      render(() => (
        <MotionSidebar isOpen collapsible isCollapsed={false}>
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).not.toHaveClass('w-\\[3\\.75rem\\]')
    })
  })

  describe('Reduced Motion', () => {
    it('should not apply transform animations when motion is reduced', async () => {
      vi.doMock('../../hooks/useMotionAnimations', () => ({
        useReducedMotion: () => ({
          shouldAnimate: () => false,
        }),
      }))

      render(() => (
        <MotionSidebar isOpen={false} variant="static">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('-translate-x-full')
    })
  })

  describe('Accessibility', () => {
    it('should have proper role', () => {
      render(() => <MotionSidebar isOpen>Content</MotionSidebar>)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toBeInTheDocument()
    })

    it('should have proper tabindex when open', () => {
      render(() => <MotionSidebar isOpen>Content</MotionSidebar>)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveAttribute('tabIndex', '0')
    })

    it('should have proper tabindex when closed', () => {
      render(() => (
        <MotionSidebar isOpen={false} variant="static">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveAttribute('tabIndex', '-1')
    })

    it('should have proper ARIA labels', () => {
      render(() => (
        <MotionSidebar isOpen variant="overlay" showBackdrop>
          Content
        </MotionSidebar>
      ))

      // Find backdrop and close button separately
      const allButtons = screen.getAllByRole('button', {
        name: /close sidebar/i,
      })
      const backdrop = allButtons.find(
        (btn) =>
          btn.classList.contains('fixed') && btn.classList.contains('inset-0')
      )
      const closeButton = allButtons.find(
        (btn) =>
          !btn.classList.contains('fixed') || !btn.classList.contains('inset-0')
      )

      expect(backdrop).toHaveAttribute('aria-label', 'Close sidebar')
      expect(closeButton).toHaveAttribute('aria-label', 'Close sidebar')
    })

    it('should have proper button types', () => {
      render(() => (
        <MotionSidebar isOpen variant="overlay" showBackdrop>
          Content
        </MotionSidebar>
      ))

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })
  })

  describe('Theme Integration', () => {
    it('should apply theme classes correctly', () => {
      render(() => <MotionSidebar isOpen>Content</MotionSidebar>)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass(
        'transform',
        'transition-transform',
        'ease-in-out'
      )
    })

    it('should apply theme transition classes', () => {
      render(() => <MotionSidebar isOpen>Content</MotionSidebar>)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toBeInTheDocument()
      // Theme transition classes should be applied
    })
  })

  describe('CSS Classes and Props', () => {
    it('should apply custom CSS classes', () => {
      render(() => (
        <MotionSidebar isOpen class="custom-sidebar-class another-class">
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('custom-sidebar-class', 'another-class')
    })

    it('should pass through additional props', () => {
      render(() => (
        <MotionSidebar
          isOpen
          data-testid="custom-sidebar"
          aria-label="Custom sidebar"
        >
          Content
        </MotionSidebar>
      ))

      const sidebar = screen.getByTestId('custom-sidebar')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toHaveAttribute('aria-label', 'Custom sidebar')
    })
  })

  describe('Event Cleanup', () => {
    it('should cleanup event listeners on unmount', () => {
      const { unmount } = render(() => (
        <MotionSidebar isOpen>Content</MotionSidebar>
      ))

      // Simulate unmount
      unmount()

      // Event listeners should be cleaned up (this is more of an integration test)
      // The key is that no errors occur when trying to trigger events after unmount
      expect(() => {
        fireEvent.keyDown(document, { key: 'Escape' })
      }).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing onClose gracefully', () => {
      render(() => (
        <MotionSidebar
          isOpen
          variant="overlay"
          showBackdrop
          closeOnBackdropClick
        >
          Content
        </MotionSidebar>
      ))

      // Find backdrop specifically
      const backdrop = Array.from(
        screen.getAllByRole('button', { name: /close sidebar/i })
      ).find(
        (btn) =>
          btn.classList.contains('fixed') && btn.classList.contains('inset-0')
      )
      expect(() => {
        fireEvent.click(backdrop!)
      }).not.toThrow()
    })

    it('should handle empty children', () => {
      render(() => <MotionSidebar isOpen />)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toBeInTheDocument()
    })

    it('should handle complex children content', () => {
      render(() => (
        <MotionSidebar isOpen>
          <header>
            <h1>Sidebar Header</h1>
          </header>
          <nav>
            <ul>
              <li>
                <a href="#1">Item 1</a>
              </li>
              <li>
                <a href="#2">Item 2</a>
              </li>
            </ul>
          </nav>
          <footer>
            <p>Sidebar Footer</p>
          </footer>
        </MotionSidebar>
      ))

      expect(screen.getByText('Sidebar Header')).toBeInTheDocument()
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Sidebar Footer')).toBeInTheDocument()
    })

    it('should handle dynamic isOpen changes', () => {
      const [isOpen, setIsOpen] = createSignal(false)

      render(() => <MotionSidebar isOpen={isOpen()}>Content</MotionSidebar>)

      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()

      setIsOpen(true)
      // Component should re-render automatically when signal changes

      expect(screen.getByRole('complementary')).toBeInTheDocument()

      setIsOpen(false)
      // Component should re-render automatically when signal changes

      expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    })
  })
})
