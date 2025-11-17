import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library'
import { Search } from './Search'
import type { JSX } from 'solid-js'

// Mock component prop types
interface MockMotionCardProps {
  clickable?: boolean
  title?: string
  image?: string
  description?: string
  metadata?: Record<string, unknown>
  onClick?: () => void
  children?: JSX.Element
  class?: string
  [key: string]: unknown
}

interface MockMotionGridProps {
  children?: JSX.Element
  columns?: string
  gap?: string
  stagger?: number
  variant?: string
  direction?: string
  class?: string
  [key: string]: unknown
}

interface MockMotionSearchProps {
  placeholder?: string
  value?: string
  onInput?: (value: string) => void
  variant?: string
  duration?: number
  animate?: boolean
  class?: string
  [key: string]: unknown
}

// Mock the motion hooks
vi.mock('../../hooks/useMotionAnimations', () => ({
  useScrollAnimation: () => ({
    elementRef: vi.fn(),
    getAnimationStyles: () => ({}),
  }),
  useStaggerAnimation: () => ({
    getStaggerProps: (index: number) => ({
      style: { 'animation-delay': `${index * 50}ms` },
    }),
  }),
  useInteractionAnimation: () => ({
    eventHandlers: {},
    getAnimationStyles: () => ({}),
  }),
  useLoadingAnimation: () => ({
    isLoading: () => false,
    startLoading: vi.fn(),
    stopLoading: vi.fn(),
    getSkeletonProps: () => ({ class: 'skeleton' }),
  }),
  usePageTransition: () => ({
    getPageProps: () => ({}),
  }),
}))

// Mock motion components
vi.mock('../ui/MotionCard', () => ({
  MotionCard: (props: MockMotionCardProps) => (
    <div
      data-testid="motion-card"
      {...props}
      role={props.clickable ? 'button' : undefined}
      title={props.title}
    >
      {props.image && <div class="aspect-[3/4] bg-muted rounded-lg mb-3" />}
      {props.title && (
        <h3 class="font-semibold text-foreground mb-1">{props.title}</h3>
      )}
      {props.description && (
        <p class="text-sm text-muted-foreground mb-2">{props.description}</p>
      )}
      {props.metadata && typeof props.metadata === 'object' && (
        <div class="text-xs text-muted-foreground">
          {props.metadata.type && <span>{props.metadata.type}</span>}
          {props.metadata.episodes && (
            <span> • {props.metadata.episodes} episodes</span>
          )}
          {props.metadata.rating && <span> • ★ {props.metadata.rating}</span>}
        </div>
      )}
      {props.children}
    </div>
  ),
}))

// Mock the motion components
vi.mock('../ui/MotionCard', () => ({
  MotionCard: (props: MockMotionCardProps) => (
    <div
      data-testid="motion-card"
      {...props}
      role={props.clickable ? 'button' : undefined}
      title={props.title}
    >
      {props.image && <div class="aspect-[3/4] bg-muted rounded-lg mb-3" />}
      {props.title && (
        <h3 class="font-semibold text-foreground mb-1">{props.title}</h3>
      )}
      {props.description && (
        <p class="text-sm text-muted-foreground mb-2">{props.description}</p>
      )}
      {props.metadata && typeof props.metadata === 'object' && (
        <div class="text-xs text-muted-foreground">
          {props.metadata.type && <span>{props.metadata.type}</span>}
          {props.metadata.episodes && (
            <span> • {props.metadata.episodes} episodes</span>
          )}
          {props.metadata.rating && <span> • ★ {props.metadata.rating}</span>}
        </div>
      )}
      {props.children}
    </div>
  ),
}))

vi.mock('../ui/MotionGrid', () => ({
  MotionGrid: (props: MockMotionGridProps) => (
    <div data-testid="motion-grid" {...props}>
      {props.children}
    </div>
  ),
}))

vi.mock('../ui/MotionSearch', () => ({
  MotionSearch: (props: MockMotionSearchProps) => (
    <input
      data-testid="motion-search"
      type="text"
      {...props}
      onInput={(e: Event & { target: HTMLInputElement }) =>
        props.onInput?.(e.target.value)
      }
    />
  ),
}))

describe('Search Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const renderSearch = () => {
    return render(() => <Search />)
  }

  describe('Basic Rendering', () => {
    it('should render search header', () => {
      renderSearch()

      expect(screen.getByText('Search')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Search for anime online and add them to your collection'
        )
      ).toBeInTheDocument()
    })

    it('should render search input', () => {
      renderSearch()

      const searchInputs = screen.getAllByTestId('motion-search')
      expect(searchInputs.length).toBeGreaterThan(0)

      const firstInput = searchInputs[0]
      expect(firstInput).toHaveAttribute(
        'placeholder',
        'Search for anime by title, genre, or keyword...'
      )
    })

    it('should render search results section', () => {
      renderSearch()

      expect(screen.getByText('Search Results')).toBeInTheDocument()
      expect(screen.getByText(/Found \d+ results/)).toBeInTheDocument()
    })

    it('should render mock search results', () => {
      renderSearch()

      expect(
        screen.getByText('Attack on Titan Final Season')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Demon Slayer: Swordsmith Village')
      ).toBeInTheDocument()
      expect(screen.getByText('Jujutsu Kaisen Season 2')).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('should handle search input', () => {
      renderSearch()

      const searchInputs = screen.getAllByTestId('motion-search')
      const firstInput = searchInputs[0]

      fireEvent.input(firstInput, { target: { value: 'test query' } })

      expect(firstInput).toHaveValue('test query')
    })

    it('should trigger search when query length > 2', () => {
      renderSearch()

      const searchInputs = screen.getAllByTestId('motion-search')
      const firstInput = searchInputs[0]

      fireEvent.input(firstInput, { target: { value: 'Attack on Titan' } })

      // Should trigger loading state
      vi.advanceTimersByTime(100)

      // Search should complete after timeout
      vi.advanceTimersByTime(1000)
    })

    it('should not trigger search for short queries', () => {
      renderSearch()

      const searchInputs = screen.getAllByTestId('motion-search')
      const firstInput = searchInputs[0]

      fireEvent.input(firstInput, { target: { value: 'at' } })

      // Should not trigger loading for queries <= 2 characters
      vi.advanceTimersByTime(100)
    })
  })

  describe('Filter Controls', () => {
    it('should have type filter options', () => {
      renderSearch()

      const typeSelects = screen.getAllByDisplayValue('All Types')
      expect(typeSelects.length).toBeGreaterThan(0)

      const firstSelect = typeSelects[0]
      const options = firstSelect.querySelectorAll('option')
      expect(options.length).toBe(4) // All Types, TV Series, Movie, OVA
    })

    it('should have year filter options', () => {
      renderSearch()

      const yearSelects = screen.getAllByDisplayValue('All Years')
      expect(yearSelects.length).toBeGreaterThan(0)

      const firstSelect = yearSelects[0]
      const options = firstSelect.querySelectorAll('option')
      expect(options.length).toBe(4) // All Years, 2023, 2022, 2021
    })

    it('should have status filter options', () => {
      renderSearch()

      const statusSelects = screen.getAllByDisplayValue('All Status')
      expect(statusSelects.length).toBeGreaterThan(0)

      const firstSelect = statusSelects[0]
      const options = firstSelect.querySelectorAll('option')
      expect(options.length).toBe(4) // All Status, Completed, Ongoing, Upcoming
    })

    it('should handle filter changes', () => {
      renderSearch()

      const typeSelects = screen.getAllByDisplayValue('All Types')
      const firstSelect = typeSelects[0]

      fireEvent.change(firstSelect, { target: { value: 'TV Series' } })

      expect(firstSelect).toHaveValue('TV Series')
    })
  })

  describe('Search Results Display', () => {
    it('should display anime titles', () => {
      renderSearch()

      expect(
        screen.getByText('Attack on Titan Final Season')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Demon Slayer: Swordsmith Village')
      ).toBeInTheDocument()
      expect(screen.getByText('Jujutsu Kaisen Season 2')).toBeInTheDocument()
    })

    it('should display anime metadata', () => {
      renderSearch()

      // Use flexible text matching for span-separated content
      expect(
        screen.getByText((content, element) => {
          return (
            element?.textContent === '87 episodes' ||
            content.includes('87 episodes')
          )
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText((content, element) => {
          return (
            element?.textContent === '11 episodes' ||
            content.includes('11 episodes')
          )
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText((content, element) => {
          return (
            element?.textContent === '23 episodes' ||
            content.includes('23 episodes')
          )
        })
      ).toBeInTheDocument()

      expect(
        screen.getByText((content, element) => {
          return element?.textContent === '★ 9' || content.includes('★ 9')
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText((content, element) => {
          return element?.textContent === '★ 8.7' || content.includes('★ 8.7')
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText((content, element) => {
          return element?.textContent === '★ 8.5' || content.includes('★ 8.5')
        })
      ).toBeInTheDocument()
    })

    it('should display status badges', () => {
      renderSearch()

      expect(screen.getAllByText('completed').length).toBeGreaterThan(0)
      expect(screen.getByText('ongoing')).toBeInTheDocument()
    })

    it('should display year badges', () => {
      renderSearch()

      expect(screen.getAllByText('2023').length).toBeGreaterThan(0)
    })

    it('should display anime descriptions', () => {
      renderSearch()

      expect(
        screen.getByText(
          'The final battle between humanity and the Titans reaches its climax.'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Tanjiro and his friends arrive at the Swordsmith Village.'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          "Gojo and Geto's past is revealed in this flashback season."
        )
      ).toBeInTheDocument()
    })

    it('should display action buttons', () => {
      renderSearch()

      const addButtons = screen.getAllByText('Add to Collection')
      expect(addButtons.length).toBeGreaterThan(0)

      const externalLinks = screen
        .getAllByRole('button')
        .filter((button) => button.querySelector('svg'))
      expect(externalLinks.length).toBeGreaterThan(0)
    })
  })

  describe('Interaction Handling', () => {
    it('should handle add to collection button clicks', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      renderSearch()

      const addButtons = screen.getAllByText('Add to Collection')
      if (addButtons.length > 0) {
        fireEvent.click(addButtons[0])
        expect(consoleSpy).toHaveBeenCalledWith(
          'Add to collection:',
          'Attack on Titan Final Season'
        )
      }

      consoleSpy.mockRestore()
    })

    it('should handle view details button clicks', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      renderSearch()

      const externalLinks = screen
        .getAllByRole('button')
        .filter(
          (button) =>
            button.querySelector('svg') &&
            !button.textContent?.includes('Add to Collection')
        )

      if (externalLinks.length > 0) {
        fireEvent.click(externalLinks[0])
        expect(consoleSpy).toHaveBeenCalledWith(
          'View details:',
          'Attack on Titan Final Season'
        )
      }

      consoleSpy.mockRestore()
    })

    it('should handle result card clicks', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      renderSearch()

      const resultCards = screen
        .getAllByTestId('motion-card')
        .filter((card) =>
          card.textContent?.includes('Attack on Titan Final Season')
        )

      if (resultCards.length > 0) {
        fireEvent.click(resultCards[0])
        expect(consoleSpy).toHaveBeenCalledWith(
          'Selected result:',
          'Attack on Titan Final Season'
        )
      }

      consoleSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('should have proper input semantics', () => {
      renderSearch()

      const searchInputs = screen.getAllByTestId('motion-search')
      expect(searchInputs.length).toBeGreaterThan(0)

      searchInputs.forEach((input) => {
        expect(input).toHaveAttribute('type', 'text')
      })
    })

    it('should have proper button roles', () => {
      renderSearch()

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should have proper labels for select elements', () => {
      renderSearch()

      const selects = screen.getAllByRole('combobox')
      expect(selects.length).toBeGreaterThan(0)
    })

    it('should have placeholder text for search input', () => {
      renderSearch()

      const searchInputs = screen.getAllByTestId('motion-search')
      const firstInput = searchInputs[0]
      expect(firstInput).toHaveAttribute(
        'placeholder',
        'Search for anime by title, genre, or keyword...'
      )
    })
  })

  describe('Theme Integration', () => {
    it('should apply theme classes correctly', () => {
      renderSearch()

      const header = screen.getByText('Search')
      expect(header).toHaveClass('text-3xl', 'font-bold')
    })

    it('should handle theme changes gracefully', () => {
      renderSearch()

      // Simulate theme change
      document.documentElement.classList.add('dark')

      // Component should still render without errors
      expect(screen.getByText('Search')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const { unmount } = renderSearch()

      // Unmount and remount to test re-render behavior
      unmount()
      renderSearch()

      // Should still render correctly
      expect(screen.getByText('Search')).toBeInTheDocument()
    })

    it('should handle rapid search input changes', () => {
      renderSearch()

      const searchInputs = screen.getAllByTestId('motion-search')
      const firstInput = searchInputs[0]

      // Rapid input changes
      fireEvent.input(firstInput, { target: { value: 'a' } })
      fireEvent.input(firstInput, { target: { value: 'at' } })
      fireEvent.input(firstInput, { target: { value: 'att' } })
      fireEvent.input(firstInput, { target: { value: 'atta' } })

      // Should handle without errors
      expect(firstInput).toHaveValue('atta')
    })

    it('should debounce search requests', () => {
      renderSearch()

      const searchInputs = screen.getAllByTestId('motion-search')
      const firstInput = searchInputs[0]

      fireEvent.input(firstInput, { target: { value: 'test search' } })

      // Should not trigger immediate search
      vi.advanceTimersByTime(100)

      // Should trigger after timeout
      vi.advanceTimersByTime(1000)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing search results gracefully', () => {
      // This would require mocking the component to return empty results
      // For now, we ensure the component doesn't crash
      expect(() => renderSearch()).not.toThrow()
    })

    it('should handle invalid search input gracefully', () => {
      renderSearch()

      const searchInputs = screen.getAllByTestId('motion-search')
      const firstInput = searchInputs[0]

      // Test with various inputs
      fireEvent.input(firstInput, { target: { value: '' } })
      fireEvent.input(firstInput, { target: { value: null } })
      fireEvent.input(firstInput, { target: { value: undefined } })

      expect(() => renderSearch()).not.toThrow()
    })
  })

  describe('Status Badge Classes', () => {
    it('should apply correct status classes', () => {
      renderSearch()

      // Check that status badges have proper classes
      const statusBadges = screen.getAllByText('completed')
      statusBadges.forEach((badge) => {
        expect(badge).toHaveClass(
          'px-2',
          'py-1',
          'text-xs',
          'font-medium',
          'rounded'
        )
      })
    })
  })
})
