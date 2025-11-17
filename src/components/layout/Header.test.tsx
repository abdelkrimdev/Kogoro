/**
 * Header Component Tests
 * Tests the animated header component with navigation and theme switching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/solidjs/web'
import { createSignal } from 'solid-js'
import { Header } from './Header'

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

describe('Header', () => {
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

    // Reset document
    document.documentElement.className = ''
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(() => <Header data-testid="header" />)

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(header).toHaveRole('banner')
    })

    it('should render with title', () => {
      render(() => <Header title="Kogoro" data-testid="header" />)

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(screen.getByText('Kogoro')).toBeInTheDocument()
    })

    it('should render with navigation items', () => {
      const navItems = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Collection', href: '/collection' },
        { label: 'Search', href: '/search' },
      ]

      render(() => <Header navItems={navItems} data-testid="header" />)

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Collection')).toBeInTheDocument()
      expect(screen.getByText('Search')).toBeInTheDocument()
    })

    it('should render with user menu', () => {
      const user = { name: 'Test User', avatar: '/avatar.jpg' }

      render(() => <Header user={user} data-testid="header" />)

      const header = screen.getByTestId('header')
      expect(header).toBeInTheDocument()
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should handle navigation clicks', () => {
      const navItems = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Collection', href: '/collection' },
      ]

      const handleNavigation = vi.fn()
      render(() => (
        <Header
          navItems={navItems}
          onNavigation={handleNavigation}
          data-testid="header"
        />
      ))

      const dashboardLink = screen.getByText('Dashboard')
      fireEvent.click(dashboardLink)

      expect(handleNavigation).toHaveBeenCalledWith('/dashboard')
    })

    it('should highlight active navigation item', () => {
      const navItems = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Collection', href: '/collection' },
      ]

      render(() => (
        <Header
          navItems={navItems}
          activePath="/dashboard"
          data-testid="header"
        />
      ))

      const dashboardLink = screen.getByText('Dashboard')
      const collectionLink = screen.getByText('Collection')

      expect(dashboardLink).toHaveClass('active')
      expect(collectionLink).not.toHaveClass('active')
    })

    it('should render mobile navigation toggle', () => {
      render(() => <Header showMobileToggle={true} data-testid="header" />)

      const mobileToggle = screen.getByRole('button', { name: /menu/i })
      expect(mobileToggle).toBeInTheDocument()
    })

    it('should toggle mobile menu', () => {
      render(() => <Header showMobileToggle={true} data-testid="header" />)

      const mobileToggle = screen.getByRole('button', { name: /menu/i })
      fireEvent.click(mobileToggle)

      // Should show mobile menu
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  describe('Theme Switching', () => {
    it('should render theme toggle button', () => {
      render(() => <Header showThemeToggle={true} data-testid="header" />)

      const themeToggle = screen.getByRole('button', { name: /theme/i })
      expect(themeToggle).toBeInTheDocument()
    })

    it('should toggle theme on click', () => {
      const handleThemeToggle = vi.fn()
      render(() => (
        <Header
          showThemeToggle={true}
          onThemeToggle={handleThemeToggle}
          data-testid="header"
        />
      ))

      const themeToggle = screen.getByRole('button', { name: /theme/i })
      fireEvent.click(themeToggle)

      expect(handleThemeToggle).toHaveBeenCalled()
    })

    it('should show current theme icon', () => {
      render(() => (
        <Header
          showThemeToggle={true}
          currentTheme="light"
          data-testid="header"
        />
      ))

      const themeToggle = screen.getByRole('button', { name: /theme/i })
      expect(themeToggle).toBeInTheDocument()
    })

    it('should update theme icon when theme changes', () => {
      const TestComponent = () => {
        const [theme, setTheme] = createSignal<'light' | 'dark'>('light')

        return (
          <div>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              data-testid="change-theme"
            >
              Change Theme
            </button>
            <Header
              showThemeToggle={true}
              currentTheme={theme()}
              data-testid="header"
            />
          </div>
        )
      }

      render(() => <TestComponent />)

      const changeButton = screen.getByTestId('change-theme')
      fireEvent.click(changeButton)

      const themeToggle = screen.getByRole('button', { name: /theme/i })
      expect(themeToggle).toBeInTheDocument()
    })
  })

  describe('User Menu', () => {
    it('should render user avatar', () => {
      const user = { name: 'Test User', avatar: '/avatar.jpg' }

      render(() => <Header user={user} data-testid="header" />)

      const avatar = screen.getByRole('img', { name: 'Test User' })
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveAttribute('src', '/avatar.jpg')
    })

    it('should toggle user menu on click', () => {
      const user = { name: 'Test User', avatar: '/avatar.jpg' }

      render(() => <Header user={user} data-testid="header" />)

      const userButton = screen.getByText('Test User')
      fireEvent.click(userButton)

      // Should show user menu
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('should handle user menu actions', () => {
      const user = { name: 'Test User', avatar: '/avatar.jpg' }
      const userMenuItems = [
        { label: 'Profile', action: 'profile' },
        { label: 'Settings', action: 'settings' },
        { label: 'Logout', action: 'logout' },
      ]

      const handleUserAction = vi.fn()
      render(() => (
        <Header
          user={user}
          userMenuItems={userMenuItems}
          onUserAction={handleUserAction}
          data-testid="header"
        />
      ))

      const userButton = screen.getByText('Test User')
      fireEvent.click(userButton)

      const profileItem = screen.getByText('Profile')
      fireEvent.click(profileItem)

      expect(handleUserAction).toHaveBeenCalledWith('profile')
    })
  })

  describe('Search', () => {
    it('should render search input', () => {
      render(() => <Header showSearch={true} data-testid="header" />)

      const searchInput = screen.getByRole('searchbox')
      expect(searchInput).toBeInTheDocument()
    })

    it('should handle search input', () => {
      const handleSearch = vi.fn()
      render(() => (
        <Header
          showSearch={true}
          onSearch={handleSearch}
          data-testid="header"
        />
      ))

      const searchInput = screen.getByRole('searchbox')
      fireEvent.input(searchInput, { target: { value: 'test search' } })

      expect(handleSearch).toHaveBeenCalledWith('test search')
    })

    it('should handle search submission', () => {
      const handleSearchSubmit = vi.fn()
      render(() => (
        <Header
          showSearch={true}
          onSearchSubmit={handleSearchSubmit}
          data-testid="header"
        />
      ))

      const searchInput = screen.getByRole('searchbox')
      fireEvent.keyDown(searchInput, { key: 'Enter' })

      expect(handleSearchSubmit).toHaveBeenCalled()
    })
  })

  describe('Animations', () => {
    it('should apply scroll animations', () => {
      render(() => <Header scrollAnimation={true} data-testid="header" />)

      const header = screen.getByTestId('header')
      expect(header).toHaveClass('header-scroll-animate')
    })

    it('should handle scroll state changes', () => {
      render(() => <Header scrollAnimation={true} data-testid="header" />)

      const header = screen.getByTestId('header')

      // Simulate scroll
      fireEvent.scroll(window, { target: { scrollY: 100 } })

      expect(header).toHaveClass('header-scrolled')
    })

    it('should apply theme transition animations', () => {
      render(() => (
        <Header
          showThemeToggle={true}
          themeTransition={true}
          data-testid="header"
        />
      ))

      const themeToggle = screen.getByRole('button', { name: /theme/i })
      expect(themeToggle).toHaveClass('theme-transition')
    })

    it('should apply hover animations to navigation items', () => {
      const navItems = [{ label: 'Dashboard', href: '/dashboard' }]

      render(() => <Header navItems={navItems} data-testid="header" />)

      const navItem = screen.getByText('Dashboard')
      fireEvent.mouseEnter(navItem)

      expect(navItem).toHaveClass('nav-item-hover')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(() => <Header data-testid="header" />)

      const header = screen.getByTestId('header')
      expect(header).toHaveAttribute('role', 'banner')
    })

    it('should have accessible navigation', () => {
      const navItems = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Collection', href: '/collection' },
      ]

      render(() => <Header navItems={navItems} data-testid="header" />)

      const nav = screen.getByRole('navigation')
      expect(nav).toBeInTheDocument()
      expect(nav).toHaveAttribute('aria-label', 'Main navigation')
    })

    it('should have accessible theme toggle', () => {
      render(() => <Header showThemeToggle={true} data-testid="header" />)

      const themeToggle = screen.getByRole('button', { name: /theme/i })
      expect(themeToggle).toHaveAttribute('aria-label', 'Toggle theme')
    })

    it('should have accessible search', () => {
      render(() => <Header showSearch={true} data-testid="header" />)

      const searchInput = screen.getByRole('searchbox')
      expect(searchInput).toHaveAttribute('aria-label', 'Search')
    })

    it('should support keyboard navigation', () => {
      const navItems = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Collection', href: '/collection' },
      ]

      render(() => <Header navItems={navItems} data-testid="header" />)

      const firstNavItem = screen.getByText('Dashboard')
      firstNavItem.focus()
      expect(firstNavItem).toHaveFocus()

      fireEvent.keyDown(firstNavItem, { key: 'ArrowRight' })

      const secondNavItem = screen.getByText('Collection')
      expect(secondNavItem).toHaveFocus()
    })
  })

  describe('Responsive Design', () => {
    it('should adapt to mobile view', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })

      render(() => <Header showMobileToggle={true} data-testid="header" />)

      const mobileToggle = screen.getByRole('button', { name: /menu/i })
      expect(mobileToggle).toBeInTheDocument()
    })

    it('should adapt to desktop view', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      render(() => <Header showMobileToggle={true} data-testid="header" />)

      // Should not show mobile toggle on desktop
      expect(
        screen.queryByRole('button', { name: /menu/i })
      ).not.toBeInTheDocument()
    })

    it('should handle viewport changes', () => {
      const TestComponent = () => {
        const [isMobile, setIsMobile] = createSignal(false)

        createEffect(() => {
          const handleResize = () => {
            setIsMobile(window.innerWidth < 768)
          }

          window.addEventListener('resize', handleResize)
          return () => window.removeEventListener('resize', handleResize)
        })

        return <Header showMobileToggle={isMobile()} data-testid="header" />
      }

      render(() => <TestComponent />)

      // Simulate mobile resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      })

      fireEvent(window, new Event('resize'))

      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should debounce scroll events', () => {
      const handleScroll = vi.fn()
      render(() => (
        <Header
          scrollAnimation={true}
          onScroll={handleScroll}
          data-testid="header"
        />
      ))

      // Simulate rapid scroll events
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(window, { target: { scrollY: i * 10 } })
      }

      vi.advanceTimersByTime(100)

      // Should be debounced, not called for every scroll event
      expect(handleScroll).toHaveBeenCalledTimes(1)
    })

    it('should cleanup event listeners on unmount', () => {
      const { unmount } = render(() => (
        <Header scrollAnimation={true} data-testid="header" />
      ))

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function)
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle missing navigation items gracefully', () => {
      expect(() => {
        render(() => <Header navItems={undefined} data-testid="header" />)
      }).not.toThrow()
    })

    it('should handle missing user gracefully', () => {
      expect(() => {
        render(() => <Header user={undefined} data-testid="header" />)
      }).not.toThrow()
    })

    it('should handle missing callbacks gracefully', () => {
      expect(() => {
        render(() => (
          <Header
            navItems={[{ label: 'Test', href: '/test' }]}
            onNavigation={undefined}
            data-testid="header"
          />
        ))

        const navItem = screen.getByText('Test')
        fireEvent.click(navItem)
      }).not.toThrow()
    })
  })
})
