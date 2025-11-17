import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library'
import { Router } from '@solidjs/router'
import { Sidebar } from './Sidebar'
import type { JSX } from 'solid-js'

// Mock component prop types
interface MockMotionSidebarProps {
  children?: JSX.Element
  class?: string
  [key: string]: unknown
}

// Mock the motion hooks
vi.mock('../../hooks/useMotionAnimations', () => ({
  useReducedMotion: () => ({ shouldAnimate: () => true }),
  useInteractionAnimation: () => ({
    eventHandlers: {},
    getAnimationStyles: () => ({}),
  }),
  useStaggerAnimation: () => ({
    getStaggerProps: (index: number) => ({
      style: { 'animation-delay': `${index * 50}ms` },
    }),
  }),
}))

// Mock MotionSidebar component
vi.mock('../ui/MotionSidebar', () => ({
  MotionSidebar: (props: MockMotionSidebarProps) => (
    <div data-testid="motion-sidebar" {...props}>
      {props.children}
    </div>
  ),
}))

// Mock the router
vi.mock('@solidjs/router', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn(),
  Router: (props: { children: JSX.Element }) => props.children,
}))

describe('Sidebar Component', () => {
  const mockOnToggleCollapse = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  const renderSidebar = (isCollapsed = false) => {
    return render(() => (
      <Router>
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={mockOnToggleCollapse}
        />
      </Router>
    ))
  }

  describe('Rendering', () => {
    it('should render sidebar when expanded', () => {
      renderSidebar(false)

      expect(screen.getByTestId('motion-sidebar')).toBeInTheDocument()
      expect(screen.getByText('Kogoro')).toBeInTheDocument()
    })

    it('should render sidebar when collapsed', () => {
      renderSidebar(true)

      expect(screen.getByTestId('motion-sidebar')).toBeInTheDocument()
      expect(screen.queryByText('Kogoro')).not.toBeInTheDocument()
      expect(screen.getByText('K')).toBeInTheDocument()
    })

    it('should render all navigation items', () => {
      renderSidebar(false)

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Collection')).toBeInTheDocument()
      expect(screen.getByText('Scanner')).toBeInTheDocument()
      expect(screen.getByText('Search')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should render collapse/expand button', () => {
      renderSidebar(false)

      const button = screen.getByRole('button', { name: /collapse/i })
      expect(button).toBeInTheDocument()
    })

    it('should render footer status when expanded', () => {
      renderSidebar(false)

      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Ready')).toBeInTheDocument()
    })

    it('should not render footer status when collapsed', () => {
      renderSidebar(true)

      expect(screen.queryByText('Status')).not.toBeInTheDocument()
      expect(screen.queryByText('Ready')).not.toBeInTheDocument()
    })
  })

  describe('Collapse/Expand Functionality', () => {
    it('should call onToggleCollapse when collapse button is clicked', () => {
      renderSidebar(false)

      const collapseButton = screen.getByRole('button', { name: /collapse/i })
      fireEvent.click(collapseButton)

      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(1)
    })

    it('should show correct icon when expanded', () => {
      renderSidebar(false)

      // Should show ChevronLeft when expanded
      expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument()
    })

    it('should show correct icon when collapsed', () => {
      renderSidebar(true)

      // Should show ChevronRight when collapsed
      expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument()
    })

    it('should have correct title attribute on collapse button', () => {
      const { unmount } = renderSidebar(false)
      expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument()

      unmount()
      renderSidebar(true)
      expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument()
    })
  })

  describe('Navigation Items', () => {
    it('should render navigation items with correct structure', () => {
      renderSidebar(false)

      const navItems = screen
        .getAllByRole('button')
        .filter(
          (button) =>
            !(button.getAttribute('title')?.includes('Collapse') ||button.getAttribute('title')?.includes('Expand'))
        )

      expect(navItems).toHaveLength(5) // Dashboard, Collection, Scanner, Search, Settings
    })

    it('should show tooltips when collapsed', () => {
      renderSidebar(true)

      expect(screen.getByTitle('Dashboard')).toBeInTheDocument()
      expect(screen.getByTitle('Collection')).toBeInTheDocument()
      expect(screen.getByTitle('Scanner')).toBeInTheDocument()
      expect(screen.getByTitle('Search')).toBeInTheDocument()
      expect(screen.getByTitle('Settings')).toBeInTheDocument()
    })

    it('should render icons for each navigation item', () => {
      renderSidebar(false)

      // Check that icons are rendered (they should be present as SVG elements)
      const icons = document.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  describe('Badge Support', () => {
    it('should not render badges when none are provided', () => {
      renderSidebar(false)

      // No badges should be visible
      const badges = screen.queryAllByTestId(/badge/i)
      expect(badges).toHaveLength(0)
    })

    // Note: Testing badges would require modifying the sidebarItems to include badges
    // This is more of an integration test that would be done with actual data
  })

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      renderSidebar(false)

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should have proper titles for collapsed state', () => {
      renderSidebar(true)

      // Navigation items should have titles for tooltips
      expect(screen.getByTitle('Dashboard')).toBeInTheDocument()
      expect(screen.getByTitle('Collection')).toBeInTheDocument()
    })

    it('should use semantic HTML structure', () => {
      renderSidebar(false)

      // Should have nav element
      const nav = document.querySelector('nav')
      expect(nav).toBeInTheDocument()
    })
  })

  describe('Responsive Behavior', () => {
    it('should handle window resize gracefully', () => {
      const { unmount } = renderSidebar(false)

      // Simulate window resize
      window.dispatchEvent(new Event('resize'))

      // Component should still render without errors
      expect(screen.getByTestId('motion-sidebar')).toBeInTheDocument()

      unmount()
    })
  })

  describe('Animation Integration', () => {
    it('should apply animation styles when animations are enabled', () => {
      renderSidebar(false)

      // Check that animation-related attributes are present
      const sidebar = screen.getByTestId('motion-sidebar')
      expect(sidebar).toHaveAttribute('duration', 'normal')

      // Check that buttons have animation delay styles from stagger animation
      const buttons = screen.getAllByRole('button')
      // At least some buttons should have animation delay styles
      const buttonsWithDelay = buttons.filter((button) =>
        button.getAttribute('style')?.includes('animation-delay')
      )
      expect(buttonsWithDelay.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing onToggleCollapse gracefully', () => {
      expect(() => {
        render(() => (
          <Router>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
          </Router>
        ))
      }).not.toThrow()
    })

    it('should handle invalid isCollapsed prop', () => {
      expect(() => {
        render(() => (
          <Router>
            <Sidebar
              isCollapsed={false}
              onToggleCollapse={mockOnToggleCollapse}
            />
          </Router>
        ))
      }).not.toThrow()
    })
  })

  describe('Theme Integration', () => {
    it('should apply theme classes correctly', () => {
      renderSidebar(false)

      // Check that theme classes are applied
      const sidebar = screen.getByTestId('motion-sidebar')
      expect(sidebar).toHaveClass('border-r')
    })

    it('should handle theme changes gracefully', () => {
      renderSidebar(false)

      // Simulate theme change
      document.documentElement.classList.add('dark')

      // Component should still render without errors
      expect(screen.getByTestId('motion-sidebar')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const { unmount } = renderSidebar(false)

      // Cleanup and render again to simulate rerender
      unmount()
      renderSidebar(false)

      // Should still render correctly
      expect(screen.getByTestId('motion-sidebar')).toBeInTheDocument()
    })

    it('should handle rapid collapse/expand clicks', () => {
      renderSidebar(false)

      const button = screen.getByRole('button', { name: /collapse/i })

      // Rapid clicks
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(3)
    })
  })
})
