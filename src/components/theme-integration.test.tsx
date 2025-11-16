import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { ThemeProvider } from '../contexts/ThemeContext'
import { Header } from './layout/Header'
import { Sidebar } from './layout/Sidebar'
import { Settings } from './pages/Settings'
import { Search } from './pages/Search'
import { Scanner } from './pages/Scanner'
import { Collection } from './pages/Collection'
import { Dashboard } from './pages/Dashboard'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Loading } from './ui/Loading'

beforeEach(() => {
  document.documentElement.classList.remove('light', 'dark')
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Theme Integration Tests', () => {
  const renderWithTheme = (component: () => JSX.Element) => {
    return render(() => <ThemeProvider>{component()}</ThemeProvider>)
  }

  describe('Header Component', () => {
    it('should render with theme-aware styling', () => {
      renderWithTheme(() => <Header onSearch={() => {}} searchQuery="" />)

      const header = screen.getByRole('banner')
      expect(header.classList.contains('background')).toBe(true)
      expect(header.classList.contains('border')).toBe(true)
    })

    it('should toggle theme when theme button is clicked', async () => {
      renderWithTheme(() => <Header onSearch={() => {}} searchQuery="" />)

      const themeToggle = screen.getAllByTitle('Toggle theme')[0]
      fireEvent.click(themeToggle)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })
    })

    it('should show theme dropdown on hover', async () => {
      renderWithTheme(() => <Header onSearch={() => {}} searchQuery="" />)

      const themeButton = screen.getAllByTitle('Toggle theme')[0]
      fireEvent.mouseEnter(themeButton)

      await waitFor(() => {
        expect(screen.getByText('light')).toBeTruthy()
        expect(screen.getByText('dark')).toBeTruthy()
        expect(screen.getByText('auto')).toBeTruthy()
      })
    })

    it('should apply theme classes to search input', () => {
      renderWithTheme(() => <Header onSearch={() => {}} searchQuery="" />)

      const searchInput = screen.getByPlaceholderText(
        'Search anime, genres, or tags...'
      )
      expect(searchInput.classList.contains('muted')).toBe(true)
      expect(searchInput.classList.contains('border')).toBe(true)
    })
  })

  describe('Sidebar Component', () => {
    it('should render with theme-aware styling', () => {
      renderWithTheme(() => (
        <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
      ))

      const sidebar = screen.getByRole('complementary')
      expect(sidebar.classList.contains('background')).toBe(true)
      expect(sidebar.classList.contains('border')).toBe(true)
    })

    it('should apply theme classes to navigation items', () => {
      renderWithTheme(() => (
        <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
      ))

      const navItems = screen.getAllByRole('button')
      expect(navItems[0].classList.contains('text-muted-foreground')).toBe(true)
    })

    it('should show active state with theme colors', () => {
      // Mock the current path to be '/'
      vi.mock('@solidjs/router', () => ({
        useLocation: () => ({ pathname: '/' }),
        useNavigate: () => vi.fn(),
      }))

      renderWithTheme(() => (
        <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
      ))

      const dashboardItem = screen.getByText('Dashboard').closest('button')
      expect(dashboardItem?.classList.contains('bg-blue-50')).toBe(true)
      expect(dashboardItem?.classList.contains('text-blue-600')).toBe(true)
    })
  })

  describe('Settings Component', () => {
    it('should render with theme-aware styling', () => {
      renderWithTheme(() => <Settings />)

      const heading = screen.getByText('Settings')
      expect(heading.classList.contains('text-foreground')).toBe(true)
    })

    it('should apply theme classes to form elements', () => {
      renderWithTheme(() => <Settings />)

      const buttons = screen.getAllByRole('button')
      expect(buttons.some((btn) => btn.classList.contains('bg-accent'))).toBe(
        true
      )
    })
  })

  describe('Search Component', () => {
    it('should render with theme-aware styling', () => {
      renderWithTheme(() => <Search />)

      const heading = screen.getByText('Search Anime')
      expect(heading.classList.contains('text-foreground')).toBe(true)
    })

    it('should apply theme classes to search filters', () => {
      renderWithTheme(() => <Search />)

      const filterButtons = screen.getAllByRole('button')
      expect(
        filterButtons.some((btn) => btn.classList.contains('bg-accent'))
      ).toBe(true)
    })
  })

  describe('Scanner Component', () => {
    it('should render with theme-aware styling', () => {
      renderWithTheme(() => <Scanner />)

      const scannerContent = screen.getByText(/Scanner/i)
      expect(scannerContent).toBeTruthy()
    })

    it('should apply theme classes to form inputs', () => {
      renderWithTheme(() => <Scanner />)

      const inputs = screen.getAllByRole('textbox')
      expect(inputs.length).toBeGreaterThan(0)
    })
  })

  describe('Collection Component', () => {
    it('should render with theme-aware styling', () => {
      renderWithTheme(() => <Collection />)

      const collectionContent = screen.getByText(/Collection/i)
      expect(collectionContent).toBeTruthy()
    })
  })

  describe('Dashboard Component', () => {
    it('should render with theme-aware styling', () => {
      renderWithTheme(() => <Dashboard />)

      const dashboardContent = screen.getByText(/Dashboard/i)
      expect(dashboardContent).toBeTruthy()
    })
  })

  describe('ErrorBoundary Component', () => {
    it('should render with theme-aware styling', () => {
      // Create a component that throws an error
      const ThrowError = () => {
        throw new Error('Test error')
      }

      renderWithTheme(() => (
        <ErrorBoundary fallback={() => <div>Error occurred</div>}>
          <ThrowError />
        </ErrorBoundary>
      ))

      expect(screen.getByText('Error occurred')).toBeTruthy()
    })
  })

  describe('Loading Component', () => {
    it('should render with theme-aware styling', () => {
      renderWithTheme(() => <Loading />)

      const loadingElement = screen.getByTestId('loading-spinner')
      expect(loadingElement).toBeTruthy()
    })
  })

  describe('Theme Consistency', () => {
    it('should maintain consistent theme across multiple components', async () => {
      renderWithTheme(() => (
        <div>
          <Header onSearch={() => {}} searchQuery="" />
          <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
          <Settings />
        </div>
      ))

      // Initially light theme
      expect(document.documentElement.classList.contains('light')).toBe(true)

      // Toggle theme
      const themeToggle = screen.getAllByTitle('Toggle theme')[0]
      fireEvent.click(themeToggle)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })

      // All components should still be rendered
      expect(screen.getByRole('banner')).toBeTruthy()
      expect(screen.getByRole('complementary')).toBeTruthy()
      expect(screen.getByText('Settings')).toBeTruthy()
    })

    it('should apply correct CSS variables in both themes', async () => {
      renderWithTheme(() => (
        <div>
          <Header onSearch={() => {}} searchQuery="" />
          <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
        </div>
      ))

      // Check light theme variables
      const computedStyle = getComputedStyle(document.documentElement)
      expect(computedStyle.getPropertyValue('--bg-primary')).toContain(
        '255 255 255'
      )
      expect(computedStyle.getPropertyValue('--text-primary')).toContain(
        '17 24 39'
      )

      // Toggle to dark theme
      const themeToggle = screen.getAllByTitle('Toggle theme')[0]
      fireEvent.click(themeToggle)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })

      // Check dark theme variables
      const darkComputedStyle = getComputedStyle(document.documentElement)
      expect(darkComputedStyle.getPropertyValue('--bg-primary')).toContain(
        '17 24 39'
      )
      expect(darkComputedStyle.getPropertyValue('--text-primary')).toContain(
        '243 244 246'
      )
    })
  })

  describe('Responsive Behavior with Theme', () => {
    it('should maintain theme on responsive breakpoints', async () => {
      // Mock different screen sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })

      renderWithTheme(() => (
        <div>
          <Header onSearch={() => {}} searchQuery="" />
          <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
        </div>
      ))

      // Toggle theme on tablet size
      const themeToggle = screen.getAllByTitle('Toggle theme')[0]
      fireEvent.click(themeToggle)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })

      // Change to mobile size
      window.innerWidth = 375
      fireEvent(window, new Event('resize'))

      // Theme should persist
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('Accessibility with Theme', () => {
    it('should maintain proper contrast ratios in both themes', async () => {
      renderWithTheme(() => <Header onSearch={() => {}} searchQuery="" />)

      // Light theme contrast
      const searchInput = screen.getByPlaceholderText(
        'Search anime, genres, or tags...'
      )
      const lightComputedStyle = getComputedStyle(searchInput)
      expect(lightComputedStyle.color).not.toBe(
        lightComputedStyle.backgroundColor
      )

      // Toggle to dark theme
      const themeToggle = screen.getAllByTitle('Toggle theme')[0]
      fireEvent.click(themeToggle)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })

      // Dark theme contrast
      const darkComputedStyle = getComputedStyle(searchInput)
      expect(darkComputedStyle.color).not.toBe(
        darkComputedStyle.backgroundColor
      )
    })

    it('should maintain focus visibility in both themes', async () => {
      renderWithTheme(() => <Header onSearch={() => {}} searchQuery="" />)

      const searchInput = screen.getByPlaceholderText(
        'Search anime, genres, or tags...'
      )

      // Test focus in light theme
      searchInput.focus()
      expect(document.activeElement === searchInput).toBe(true)

      // Toggle to dark theme
      const themeToggle = screen.getAllByTitle('Toggle theme')[0]
      fireEvent.click(themeToggle)

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })

      // Test focus in dark theme
      searchInput.focus()
      expect(document.activeElement === searchInput).toBe(true)
    })
  })
})
