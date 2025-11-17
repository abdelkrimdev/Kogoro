/**
 * Dashboard Component Tests
 * Tests the animated dashboard component with stats and charts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/solidjs/web'
import { createSignal } from 'solid-js'
import { Dashboard } from './Dashboard'

// Mock window and browser APIs
const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})
window.IntersectionObserver = mockIntersectionObserver

const mockRequestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
const mockCancelAnimationFrame = vi.fn()
window.requestAnimationFrame = mockRequestAnimationFrame
window.cancelAnimationFrame = mockCancelAnimationFrame

describe('Dashboard', () => {
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
      render(() => <Dashboard data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(dashboard).toHaveRole('main')
    })

    it('should render with title', () => {
      render(() => <Dashboard title="My Dashboard" data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByText('My Dashboard')).toBeInTheDocument()
    })

    it('should render with stats', () => {
      const stats = [
        { label: 'Total Anime', value: 150, change: '+5%' },
        { label: 'Watched', value: 120, change: '+3%' },
        { label: 'Plan to Watch', value: 30, change: '+2%' },
      ]

      render(() => <Dashboard stats={stats} data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByText('Total Anime')).toBeInTheDocument()
      expect(screen.getByText('150')).toBeInTheDocument()
      expect(screen.getByText('+5%')).toBeInTheDocument()
    })

    it('should render with recent activity', () => {
      const recentActivity = [
        {
          id: 1,
          title: 'Attack on Titan',
          action: 'completed',
          time: '2 hours ago',
        },
        { id: 2, title: 'Demon Slayer', action: 'started', time: '1 day ago' },
      ]

      render(() => (
        <Dashboard recentActivity={recentActivity} data-testid="dashboard" />
      ))

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByText('Attack on Titan')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('Demon Slayer')).toBeInTheDocument()
      expect(screen.getByText('started')).toBeInTheDocument()
    })
  })

  describe('Stats Section', () => {
    it('should render stats with animations', () => {
      const stats = [
        { label: 'Total Anime', value: 150, change: '+5%' },
        { label: 'Watched', value: 120, change: '+3%' },
      ]

      render(() => (
        <Dashboard stats={stats} animateStats={true} data-testid="dashboard" />
      ))

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByTestId('stats-section')).toBeInTheDocument()
      expect(screen.getByTestId('stats-section')).toHaveClass('stats-animate')
    })

    it('should handle stat clicks', () => {
      const stats = [{ label: 'Total Anime', value: 150, change: '+5%' }]

      const handleStatClick = vi.fn()
      render(() => (
        <Dashboard
          stats={stats}
          onStatClick={handleStatClick}
          data-testid="dashboard"
        />
      ))

      const statCard = screen.getByText('Total Anime')
      fireEvent.click(statCard)

      expect(handleStatClick).toHaveBeenCalledWith(stats[0])
    })

    it('should show stat change indicators', () => {
      const stats = [
        { label: 'Total Anime', value: 150, change: '+5%', trend: 'up' },
        { label: 'Dropped', value: 5, change: '-2%', trend: 'down' },
      ]

      render(() => <Dashboard stats={stats} data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByText('+5%')).toBeInTheDocument()
      expect(screen.getByText('-2%')).toBeInTheDocument()
    })
  })

  describe('Charts Section', () => {
    it('should render chart with animations', () => {
      const chartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        datasets: [
          { label: 'Watched', data: [10, 15, 12, 18, 20] },
          { label: 'Completed', data: [8, 12, 10, 15, 18] },
        ],
      }

      render(() => (
        <Dashboard
          chartData={chartData}
          animateCharts={true}
          data-testid="dashboard"
        />
      ))

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByTestId('chart-section')).toBeInTheDocument()
      expect(screen.getByTestId('chart-section')).toHaveClass('chart-animate')
    })

    it('should handle chart type changes', () => {
      const chartData = {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [{ label: 'Watched', data: [10, 15, 12] }],
      }

      const TestComponent = () => {
        const [chartType, setChartType] = createSignal<'line' | 'bar'>('line')

        return (
          <div>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              data-testid="change-chart-type"
            >
              Change to Bar
            </button>
            <Dashboard
              chartData={chartData}
              chartType={chartType()}
              data-testid="dashboard"
            />
          </div>
        )
      }

      render(() => <TestComponent />)

      const changeButton = screen.getByTestId('change-chart-type')
      fireEvent.click(changeButton)

      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    it('should handle chart interactions', () => {
      const chartData = {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [{ label: 'Watched', data: [10, 15, 12] }],
      }

      const handleChartClick = vi.fn()
      render(() => (
        <Dashboard
          chartData={chartData}
          onChartClick={handleChartClick}
          data-testid="dashboard"
        />
      ))

      const chart = screen.getByTestId('chart-section')
      fireEvent.click(chart)

      expect(handleChartClick).toHaveBeenCalled()
    })
  })

  describe('Recent Activity', () => {
    it('should render activity with stagger animations', () => {
      const recentActivity = [
        {
          id: 1,
          title: 'Attack on Titan',
          action: 'completed',
          time: '2 hours ago',
        },
        { id: 2, title: 'Demon Slayer', action: 'started', time: '1 day ago' },
        { id: 3, title: 'One Piece', action: 'paused', time: '2 days ago' },
      ]

      render(() => (
        <Dashboard
          recentActivity={recentActivity}
          animateActivity={true}
          data-testid="dashboard"
        />
      ))

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByTestId('activity-section')).toBeInTheDocument()
      expect(screen.getByTestId('activity-section')).toHaveClass(
        'activity-stagger'
      )
    })

    it('should handle activity item clicks', () => {
      const recentActivity = [
        {
          id: 1,
          title: 'Attack on Titan',
          action: 'completed',
          time: '2 hours ago',
        },
      ]

      const handleActivityClick = vi.fn()
      render(() => (
        <Dashboard
          recentActivity={recentActivity}
          onActivityClick={handleActivityClick}
          data-testid="dashboard"
        />
      ))

      const activityItem = screen.getByText('Attack on Titan')
      fireEvent.click(activityItem)

      expect(handleActivityClick).toHaveBeenCalledWith(recentActivity[0])
    })

    it('should load more activity', () => {
      const recentActivity = [
        {
          id: 1,
          title: 'Attack on Titan',
          action: 'completed',
          time: '2 hours ago',
        },
      ]

      const handleLoadMore = vi.fn()
      render(() => (
        <Dashboard
          recentActivity={recentActivity}
          onLoadMore={handleLoadMore}
          data-testid="dashboard"
        />
      ))

      const loadMoreButton = screen.getByText('Load More')
      fireEvent.click(loadMoreButton)

      expect(handleLoadMore).toHaveBeenCalled()
    })
  })

  describe('Quick Actions', () => {
    it('should render quick actions with animations', () => {
      const quickActions = [
        { label: 'Add Anime', icon: '+', action: 'add' },
        { label: 'Search', icon: '🔍', action: 'search' },
        { label: 'Import', icon: '📁', action: 'import' },
      ]

      render(() => (
        <Dashboard
          quickActions={quickActions}
          animateActions={true}
          data-testid="dashboard"
        />
      ))

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByTestId('quick-actions')).toBeInTheDocument()
      expect(screen.getByTestId('quick-actions')).toHaveClass('actions-animate')
    })

    it('should handle quick action clicks', () => {
      const quickActions = [{ label: 'Add Anime', icon: '+', action: 'add' }]

      const handleActionClick = vi.fn()
      render(() => (
        <Dashboard
          quickActions={quickActions}
          onActionClick={handleActionClick}
          data-testid="dashboard"
        />
      ))

      const actionButton = screen.getByText('Add Anime')
      fireEvent.click(actionButton)

      expect(handleActionClick).toHaveBeenCalledWith('add')
    })

    it('should show action tooltips on hover', () => {
      const quickActions = [
        {
          label: 'Add Anime',
          icon: '+',
          action: 'add',
          tooltip: 'Add new anime to collection',
        },
      ]

      render(() => (
        <Dashboard quickActions={quickActions} data-testid="dashboard" />
      ))

      const actionButton = screen.getByText('Add Anime')
      fireEvent.mouseEnter(actionButton)

      expect(
        screen.getByText('Add new anime to collection')
      ).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should show loading skeleton', () => {
      render(() => <Dashboard loading={true} data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
      expect(dashboard).toHaveAttribute('aria-busy', 'true')
    })

    it('should show partial loading', () => {
      render(() => (
        <Dashboard
          loadingStats={true}
          loadingCharts={false}
          data-testid="dashboard"
        />
      ))

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByTestId('stats-loading')).toBeInTheDocument()
      expect(screen.queryByTestId('charts-loading')).not.toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('should show error message', () => {
      render(() => (
        <Dashboard error="Failed to load dashboard" data-testid="dashboard" />
      ))

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toBeInTheDocument()
      expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument()
      expect(screen.getByTestId('error-message')).toBeInTheDocument()
    })

    it('should handle retry action', () => {
      const handleRetry = vi.fn()
      render(() => (
        <Dashboard
          error="Failed to load dashboard"
          onRetry={handleRetry}
          data-testid="dashboard"
        />
      ))

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      expect(handleRetry).toHaveBeenCalled()
    })
  })

  describe('Animations', () => {
    it('should apply entrance animations', () => {
      render(() => <Dashboard animateOnMount={true} data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toHaveClass('dashboard-entrance')
    })

    it('should apply scroll animations', () => {
      render(() => <Dashboard scrollAnimation={true} data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toHaveClass('dashboard-scroll-animate')
    })

    it('should handle animation state changes', () => {
      const TestComponent = () => {
        const [isAnimating, setIsAnimating] = createSignal(false)

        return (
          <div>
            <button
              type="button"
              onClick={() => setIsAnimating(!isAnimating())}
              data-testid="toggle-animation"
            >
              Toggle Animation
            </button>
            <Dashboard isAnimating={isAnimating()} data-testid="dashboard" />
          </div>
        )
      }

      render(() => <TestComponent />)

      const toggleButton = screen.getByTestId('toggle-animation')
      fireEvent.click(toggleButton)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toHaveClass('dashboard-animating')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(() => <Dashboard data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toHaveAttribute('role', 'main')
      expect(dashboard).toHaveAttribute('aria-label', 'Dashboard')
    })

    it('should have accessible stats', () => {
      const stats = [{ label: 'Total Anime', value: 150, change: '+5%' }]

      render(() => <Dashboard stats={stats} data-testid="dashboard" />)

      const statsSection = screen.getByTestId('stats-section')
      expect(statsSection).toHaveAttribute('aria-label', 'Statistics')
      expect(statsSection).toHaveAttribute('role', 'region')
    })

    it('should have accessible charts', () => {
      const chartData = {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [{ label: 'Watched', data: [10, 15, 12] }],
      }

      render(() => <Dashboard chartData={chartData} data-testid="dashboard" />)

      const chartSection = screen.getByTestId('chart-section')
      expect(chartSection).toHaveAttribute('aria-label', 'Analytics chart')
      expect(chartSection).toHaveAttribute('role', 'img')
    })

    it('should support keyboard navigation', () => {
      const quickActions = [
        { label: 'Add Anime', icon: '+', action: 'add' },
        { label: 'Search', icon: '🔍', action: 'search' },
      ]

      render(() => (
        <Dashboard quickActions={quickActions} data-testid="dashboard" />
      ))

      const firstAction = screen.getByText('Add Anime')
      firstAction.focus()
      expect(firstAction).toHaveFocus()

      fireEvent.keyDown(firstAction, { key: 'ArrowRight' })

      const secondAction = screen.getByText('Search')
      expect(secondAction).toHaveFocus()
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

      render(() => <Dashboard data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toHaveClass('dashboard-mobile')
    })

    it('should adapt to tablet view', () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      render(() => <Dashboard data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toHaveClass('dashboard-tablet')
    })

    it('should adapt to desktop view', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })

      render(() => <Dashboard data-testid="dashboard" />)

      const dashboard = screen.getByTestId('dashboard')
      expect(dashboard).toHaveClass('dashboard-desktop')
    })
  })

  describe('Performance', () => {
    it('should debounce resize events', () => {
      const handleResize = vi.fn()
      render(() => (
        <Dashboard onResize={handleResize} data-testid="dashboard" />
      ))

      // Simulate rapid resize events
      for (let i = 0; i < 10; i++) {
        fireEvent(window, new Event('resize'))
      }

      vi.advanceTimersByTime(100)

      // Should be debounced, not called for every resize event
      expect(handleResize).toHaveBeenCalledTimes(1)
    })

    it('should cleanup IntersectionObserver on unmount', () => {
      const { unmount } = render(() => (
        <Dashboard scrollAnimation={true} data-testid="dashboard" />
      ))

      const mockDisconnect = vi.fn()
      mockIntersectionObserver.mockReturnValue({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: mockDisconnect,
      })

      unmount()
      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing data gracefully', () => {
      expect(() => {
        render(() => (
          <Dashboard
            stats={undefined}
            chartData={undefined}
            recentActivity={undefined}
            data-testid="dashboard"
          />
        ))
      }).not.toThrow()
    })

    it('should handle missing callbacks gracefully', () => {
      expect(() => {
        render(() => (
          <Dashboard
            stats={[{ label: 'Test', value: 100 }]}
            onStatClick={undefined}
            data-testid="dashboard"
          />
        ))

        const stat = screen.getByText('Test')
        fireEvent.click(stat)
      }).not.toThrow()
    })
  })
})
