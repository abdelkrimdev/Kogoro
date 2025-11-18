import { type Component, For, Show, createSignal } from 'solid-js'
import { Search as SearchIcon, ExternalLink } from 'lucide-solid'
import {
  cn,
  getStatusClasses,
  getThemeComponentClasses,
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
} from '@/lib/utils'
import { MotionCard } from '../ui/MotionCard'
import { MotionGrid } from '../ui/MotionGrid'
import { MotionSearch } from '../ui/MotionSearch'
import {
  useScrollAnimation,
  useStaggerAnimation,
  useInteractionAnimation,
  useLoadingAnimation,
  usePageTransition,
} from '../../hooks/useMotionAnimations'
import { MOTION_VARIANTS } from '../../lib/motion-variants'

export const Search: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('')
  const [_isSearching, setIsSearching] = createSignal(false)

  // Setup page transition animation
  const { getPageProps } = usePageTransition({
    variant: MOTION_VARIANTS.page.fade,
    duration: 'normal',
  })

  // Setup scroll animations
  const { elementRef: headerRef, getAnimationStyles: getHeaderStyles } =
    useScrollAnimation({
      threshold: 0.1,
      triggerOnce: true,
    })

  const { elementRef: searchRef, getAnimationStyles: getSearchStyles } =
    useScrollAnimation({
      threshold: 0.1,
      triggerOnce: true,
      delay: 100,
    })

  const { elementRef: resultsRef, getAnimationStyles: getResultsStyles } =
    useScrollAnimation({
      threshold: 0.1,
      triggerOnce: true,
      delay: 200,
    })

  // Setup stagger animation for search results
  const { getStaggerProps } = useStaggerAnimation({
    baseDelay: 75,
    maxDelay: 600,
    direction: 'vertical',
  })

  // Setup interaction animation for result cards
  const { eventHandlers: cardHandlers, getAnimationStyles: getCardStyles } =
    useInteractionAnimation({
      hoverVariant: MOTION_VARIANTS.hover.lift,
      tapVariant: MOTION_VARIANTS.tap.press,
    })

  // Setup loading animation for search
  const { isLoading, startLoading, stopLoading, getSkeletonProps } =
    useLoadingAnimation({
      type: 'skeleton',
      size: 'medium',
    })

  // Mock search results
  const searchResults = [
    {
      id: 1,
      title: 'Attack on Titan Final Season',
      type: 'TV Series',
      episodes: 87,
      rating: 9.0,
      year: 2023,
      synopsis:
        'The final battle between humanity and the Titans reaches its climax.',
      genres: ['Action', 'Drama', 'Fantasy'],
      image: '/api/placeholder/300/400',
      status: 'completed',
    },
    {
      id: 2,
      title: 'Demon Slayer: Swordsmith Village',
      type: 'TV Series',
      episodes: 11,
      rating: 8.7,
      year: 2023,
      synopsis: 'Tanjiro and his friends arrive at the Swordsmith Village.',
      genres: ['Action', 'Historical', 'Supernatural'],
      image: '/api/placeholder/300/400',
      status: 'completed',
    },
    {
      id: 3,
      title: 'Jujutsu Kaisen Season 2',
      type: 'TV Series',
      episodes: 23,
      rating: 8.5,
      year: 2023,
      synopsis: "Gojo and Geto's past is revealed in this flashback season.",
      genres: ['Action', 'School', 'Supernatural'],
      image: '/api/placeholder/300/400',
      status: 'ongoing',
    },
  ]

  const getStatusBadgeClasses = (status: string) => {
    const statusMap = {
      completed: 'success',
      ongoing: 'info',
      upcoming: 'warning',
    }
    const statusType = statusMap[status as keyof typeof statusMap] || 'info'
    return cn(
      getStatusClasses(statusType, 'bg'),
      getStatusClasses(statusType, 'text'),
      'px-2 py-1 text-xs font-medium rounded'
    )
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.length > 2) {
      setIsSearching(true)
      startLoading()
      // Simulate search delay
      setTimeout(() => {
        setIsSearching(false)
        stopLoading()
      }, 1000)
    }
  }

  return (
    <div {...getPageProps()} class="space-y-6">
      {/* Header */}
      <div ref={headerRef} style={getHeaderStyles()}>
        <h1 class={cn('text-3xl font-bold', getTextClasses('primary'))}>
          Search
        </h1>
        <p class={cn('mt-2', getTextClasses('secondary'))}>
          Search for anime online and add them to your collection
        </p>
      </div>

      {/* Search Form */}
      <div ref={searchRef} style={getSearchStyles()}>
        <MotionCard
          variant="standard"
          animateOnScroll={false}
          class="p-6 shadow-sm"
        >
          <MotionSearch
            placeholder="Search for anime by title, genre, or keyword..."
            value={searchQuery()}
            onInput={handleSearch}
            variant="slide"
            duration={0.3}
            animate={true}
            class="flex-1"
          />

          {/* Search Filters */}
          <div class="mt-4 flex flex-wrap gap-2">
            <select
              class={cn(
                'px-3 py-1 rounded-lg text-sm focus:outline-none focus-ring transition-colors',
                getBackgroundClasses('tertiary'),
                getBorderClasses('secondary'),
                getTextClasses('primary')
              )}
            >
              <option>All Types</option>
              <option>TV Series</option>
              <option>Movie</option>
              <option>OVA</option>
            </select>

            <select
              class={cn(
                'px-3 py-1 rounded-lg text-sm focus:outline-none focus-ring transition-colors',
                getBackgroundClasses('tertiary'),
                getBorderClasses('secondary'),
                getTextClasses('primary')
              )}
            >
              <option>All Years</option>
              <option>2023</option>
              <option>2022</option>
              <option>2021</option>
            </select>

            <select
              class={cn(
                'px-3 py-1 rounded-lg text-sm focus:outline-none focus-ring transition-colors',
                getBackgroundClasses('tertiary'),
                getBorderClasses('secondary'),
                getTextClasses('primary')
              )}
            >
              <option>All Status</option>
              <option>Completed</option>
              <option>Ongoing</option>
              <option>Upcoming</option>
            </select>
          </div>
        </MotionCard>
      </div>

      {/* Search Results */}
      <div ref={resultsRef} style={getResultsStyles()}>
        <div class="flex items-center justify-between mb-4">
          <h2 class={cn('text-lg font-semibold', getTextClasses('primary'))}>
            Search Results
          </h2>
          <p class={cn('text-sm', getTextClasses('secondary'))}>
            Found {searchResults.length} results
          </p>
        </div>

        <Show
          when={searchResults.length > 0}
          fallback={
            <div class="text-center py-12">
              <SearchIcon
                class={cn('w-12 h-12 mx-auto mb-4', getTextClasses('tertiary'))}
              />
              <h3
                class={cn(
                  'text-lg font-medium mb-2',
                  getTextClasses('primary')
                )}
              >
                No results found
              </h3>
              <p class={cn(getTextClasses('secondary'))}>
                Try adjusting your search terms or filters
              </p>
            </div>
          }
        >
          <Show
            when={!isLoading()}
            fallback={
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <For each={Array(6)}>
                  {() => (
                    <div {...getSkeletonProps()} class="h-96 rounded-lg" />
                  )}
                </For>
              </div>
            }
          >
            <MotionGrid
              columns="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              gap="1.5rem"
              stagger={100}
              variant="slide"
              direction="up"
            >
              <For each={searchResults}>
                {(result, index) => (
                  <MotionCard
                    variant="featured"
                    clickable={true}
                    animateOnScroll={false}
                    {...getStaggerProps(index())}
                    {...cardHandlers}
                    style={getCardStyles()}
                    metadata={{
                      year: result.year,
                      episodes: result.episodes,
                      rating: result.rating,
                      status:
                        result.status === 'completed'
                          ? 'completed'
                          : 'watching',
                      genres: result.genres,
                    }}
                    image={result.image}
                    title={result.title}
                    description={result.synopsis}
                    onClick={() =>
                      console.log('Selected result:', result.title)
                    }
                  >
                    {/* Status Badge */}
                    <div class="absolute top-2 left-2">
                      <span class={getStatusBadgeClasses(result.status)}>
                        {result.status}
                      </span>
                    </div>

                    {/* Year Badge */}
                    <div class="absolute top-2 right-2">
                      <span
                        class={cn(
                          'text-xs px-2 py-1 rounded backdrop-blur-sm',
                          getBackgroundClasses('tertiary'),
                          getTextClasses('primary')
                        )}
                      >
                        {result.year}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div class="flex space-x-2 mt-4">
                      <button
                        type="button"
                        class={cn(
                          'flex-1 px-3 py-2 text-sm rounded-lg transition-colors focus-ring',
                          'bg-accent text-accent-foreground hover:bg-accent-hover'
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('Add to collection:', result.title)
                        }}
                      >
                        Add to Collection
                      </button>
                      <button
                        type="button"
                        class={cn(
                          'p-2 rounded-lg transition-colors focus-ring',
                          getThemeComponentClasses({
                            variant: 'muted',
                            interactive: true,
                          })
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          console.log('View details:', result.title)
                        }}
                      >
                        <ExternalLink class="w-4 h-4" />
                      </button>
                    </div>
                  </MotionCard>
                )}
              </For>
            </MotionGrid>
          </Show>
        </Show>
      </div>
    </div>
  )
}
