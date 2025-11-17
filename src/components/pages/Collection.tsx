import { type Component, For, Show, createSignal } from 'solid-js'
import {
  Grid3x3 as Grid,
  List,
  Filter,
  ArrowUpDown as SortAsc,
  Search,
} from 'lucide-solid'
import { appState, storeUtils, storeActions } from '../../lib/store'
import {
  cn,
  getStatusClasses,
  getThemeComponentClasses,
  getTextClasses,
  getBackgroundClasses,
  getBorderClasses,
  getAccentClasses,
} from '../../lib/utils'
import { MotionCard } from '../ui/MotionCard'
import { MotionGrid } from '../ui/MotionGrid'
import { MotionList } from '../ui/MotionList'
import {
  useScrollAnimation,
  useStaggerAnimation,
  useInteractionAnimation,
  useLoadingAnimation,
  usePageTransition,
} from '../../hooks/useMotionAnimations'
import { MOTION_VARIANTS } from '../../lib/motion-variants'

type ViewMode = 'grid' | 'list'
type SortBy = 'title' | 'date' | 'rating' | 'episodes'
type SortOrder = 'asc' | 'desc'

export const Collection: Component = () => {
  const [viewMode, setViewMode] = createSignal<ViewMode>('grid')
  const [sortBy, setSortBy] = createSignal<SortBy>('title')
  const [sortOrder, setSortOrder] = createSignal<SortOrder>('asc')
  const [showFilters, setShowFilters] = createSignal(false)

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

  const { elementRef: filtersRef, getAnimationStyles: getFiltersStyles } =
    useScrollAnimation({
      threshold: 0.1,
      triggerOnce: true,
      delay: 100,
    })

  const { elementRef: contentRef, getAnimationStyles: getContentStyles } =
    useScrollAnimation({
      threshold: 0.1,
      triggerOnce: true,
      delay: 200,
    })

  // Setup stagger animation for collection items
  const { getStaggerProps } = useStaggerAnimation({
    baseDelay: 50,
    maxDelay: 800,
    direction: 'vertical',
  })

  // Setup interaction animation for view controls
  const { eventHandlers: viewHandlers, getAnimationStyles: getViewStyles } =
    useInteractionAnimation({
      hoverVariant: MOTION_VARIANTS.hover.lift,
    })

  // Setup loading animation for filter changes
  const { isLoading, startLoading, stopLoading, getSkeletonProps } =
    useLoadingAnimation({
      type: 'skeleton',
      size: 'medium',
    })

  const filteredAnime = () => storeUtils.getFilteredAnime()

  const handleSort = (newSortBy: SortBy) => {
    startLoading()
    if (sortBy() === newSortBy) {
      setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('asc')
    }
    // Simulate sorting delay
    setTimeout(stopLoading, 300)
  }

  const getAnimeTypeColor = (type: string) => {
    // Use semantic colors for consistent theming
    const typeColorMap: Record<
      string,
      'info' | 'warning' | 'success' | 'error'
    > = {
      'TV Series': 'info',
      Movie: 'warning',
      OVA: 'success',
      Special: 'error',
      ONA: 'info',
      Music: 'warning',
    }

    const colorType = typeColorMap[type] || 'info'
    return cn(
      getStatusClasses(colorType, 'bg'),
      getStatusClasses(colorType, 'text'),
      'px-2 py-1 text-xs font-medium rounded'
    )
  }

  return (
    <div {...getPageProps()} class="space-y-6">
      {/* Header */}
      <div
        ref={headerRef}
        style={getHeaderStyles()}
        class="flex items-center justify-between"
      >
        <div>
          <h1 class={cn('text-3xl font-bold', getTextClasses('primary'))}>
            Collection
          </h1>
          <p class={cn('mt-2', getTextClasses('secondary'))}>
            Browse and manage your anime collection
          </p>
        </div>

        {/* View Controls */}
        <div class="flex items-center space-x-2">
          <MotionCard
            variant="compact"
            clickable={true}
            onClick={() => setShowFilters(!showFilters())}
            animateOnScroll={false}
            class={cn(
              'p-2',
              showFilters()
                ? cn(
                    getStatusClasses('info', 'bg'),
                    getStatusClasses('info', 'text')
                  )
                : cn(
                    getBackgroundClasses('tertiary'),
                    getTextClasses('secondary'),
                    'hover:bg-muted'
                  )
            )}
            title="Toggle filters"
          >
            <Filter class="w-5 h-5" />
          </MotionCard>

          <div
            class={cn(
              'flex items-center rounded-lg p-1',
              getBackgroundClasses('secondary')
            )}
            {...viewHandlers}
            style={getViewStyles()}
          >
            <MotionCard
              variant="compact"
              clickable={true}
              onClick={() => setViewMode('grid')}
              animateOnScroll={false}
              class={cn(
                'p-2 rounded transition-colors',
                viewMode() === 'grid'
                  ? cn(
                      getBackgroundClasses('primary'),
                      getAccentClasses('default'),
                      'shadow-sm'
                    )
                  : cn(getTextClasses('secondary'), 'hover:text-foreground')
              )}
              title="Grid view"
            >
              <Grid class="w-4 h-4" />
            </MotionCard>
            <MotionCard
              variant="compact"
              clickable={true}
              onClick={() => setViewMode('list')}
              animateOnScroll={false}
              class={cn(
                'p-2 rounded transition-colors',
                viewMode() === 'list'
                  ? cn(
                      getBackgroundClasses('primary'),
                      getAccentClasses('default'),
                      'shadow-sm'
                    )
                  : cn(getTextClasses('secondary'), 'hover:text-foreground')
              )}
              title="List view"
            >
              <List class="w-4 h-4" />
            </MotionCard>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Show when={showFilters()}>
        <MotionCard
          ref={filtersRef}
          style={getFiltersStyles()}
          variant="standard"
          animateOnScroll={false}
          class="p-4"
        >
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                for="sort-by"
                class={cn(
                  'block text-sm font-medium mb-2',
                  getTextClasses('secondary')
                )}
              >
                Sort By
              </label>
              <select
                id="sort-by"
                value={sortBy()}
                onChange={(e) => handleSort(e.target.value as SortBy)}
                class={cn(
                  'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring',
                  getBackgroundClasses('primary'),
                  getBorderClasses('secondary'),
                  getTextClasses('primary')
                )}
              >
                <option value="title">Title</option>
                <option value="date">Start Date</option>
                <option value="rating">Rating</option>
                <option value="episodes">Episodes</option>
              </select>
            </div>

            <div>
              <label
                for="sort-order"
                class={cn(
                  'block text-sm font-medium mb-2',
                  getTextClasses('secondary')
                )}
              >
                Order
              </label>
              <button
                id="sort-order"
                type="button"
                onClick={() =>
                  setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')
                }
                class={cn(
                  'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring flex items-center justify-center space-x-2 transition-colors',
                  getThemeComponentClasses({
                    variant: 'default',
                    interactive: true,
                  })
                )}
              >
                <SortAsc
                  class={cn(
                    'w-4 h-4',
                    sortOrder() === 'desc' ? 'rotate-180' : ''
                  )}
                />
                <span>
                  {sortOrder() === 'asc' ? 'Ascending' : 'Descending'}
                </span>
              </button>
            </div>

            <div>
              <label
                for="filter-type"
                class={cn(
                  'block text-sm font-medium mb-2',
                  getTextClasses('secondary')
                )}
              >
                Type
              </label>
              <select
                id="filter-type"
                value={appState.filterType}
                onChange={(e) =>
                  storeActions.setFilter(appState.filterGenre, e.target.value)
                }
                class={cn(
                  'w-full px-3 py-2 rounded-lg focus:outline-none focus-ring',
                  getBackgroundClasses('primary'),
                  getBorderClasses('secondary'),
                  getTextClasses('primary')
                )}
              >
                <option value="">All Types</option>
                <option value="TV Series">TV Series</option>
                <option value="Movie">Movie</option>
                <option value="OVA">OVA</option>
                <option value="Special">Special</option>
                <option value="ONA">ONA</option>
                <option value="Music">Music</option>
              </select>
            </div>
          </div>
        </MotionCard>
      </Show>

      {/* Results Count */}
      <div
        ref={contentRef}
        style={getContentStyles()}
        class="flex items-center justify-between"
      >
        <p class={cn('text-sm', getTextClasses('secondary'))}>
          Showing {filteredAnime().length} anime
        </p>
      </div>

      {/* Collection Content */}
      <Show
        when={filteredAnime().length > 0}
        fallback={
          <div class="text-center py-12">
            <Search
              class={cn('w-12 h-12 mx-auto mb-4', getTextClasses('tertiary'))}
            />
            <h3
              class={cn('text-lg font-medium mb-2', getTextClasses('primary'))}
            >
              No anime found
            </h3>
            <p class={cn(getTextClasses('secondary'))}>
              Try adjusting your search or filters
            </p>
          </div>
        }
      >
        {/* Grid View */}
        <Show when={viewMode() === 'grid'}>
          <Show
            when={!isLoading()}
            fallback={
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                <For each={Array(10)}>
                  {() => (
                    <div
                      {...getSkeletonProps()}
                      class="aspect-[3/4] rounded-lg"
                    />
                  )}
                </For>
              </div>
            }
          >
            <MotionGrid
              columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              gap="1.5rem"
              stagger={50}
              variant="scale"
              direction="up"
            >
              <For each={filteredAnime()}>
                {(anime, index) => (
                  <MotionCard
                    variant="standard"
                    clickable={true}
                    animateOnScroll={false}
                    {...getStaggerProps(index())}
                    metadata={{
                      year: anime.year,
                      episodes: anime.episodes,
                      rating: anime.rating,
                      status: anime.watched ? 'completed' : 'watching',
                    }}
                    image={anime.picture || '/api/placeholder/300/400'}
                    title={anime.title}
                    description={`${anime.episodes} episodes`}
                    onClick={() => console.log('Selected anime:', anime.title)}
                  >
                    {/* Type Badge */}
                    <div class="absolute top-2 left-2">
                      <span class={getAnimeTypeColor(anime.type)}>
                        {anime.type}
                      </span>
                    </div>

                    {/* Favorite Badge */}
                    <Show when={anime.favorite}>
                      <div class="absolute top-2 right-2">
                        <div
                          class={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            getStatusClasses('warning', 'bg')
                          )}
                        >
                          <span
                            class={cn(
                              'text-sm',
                              getStatusClasses('warning', 'text')
                            )}
                          >
                            ★
                          </span>
                        </div>
                      </div>
                    </Show>
                  </MotionCard>
                )}
              </For>
            </MotionGrid>
          </Show>
        </Show>

        {/* List View */}
        <Show when={viewMode() === 'list'}>
          <Show
            when={!isLoading()}
            fallback={
              <div class="space-y-2">
                <For each={Array(5)}>
                  {() => (
                    <div {...getSkeletonProps()} class="h-24 rounded-lg" />
                  )}
                </For>
              </div>
            }
          >
            <MotionCard variant="standard" animateOnScroll={false}>
              <MotionList
                items={filteredAnime()}
                animation="slide"
                direction="up"
                staggerDelay={75}
                renderItem={(anime, index) => (
                  <MotionCard
                    variant="compact"
                    clickable={true}
                    animateOnScroll={false}
                    {...getStaggerProps(index())}
                    class="p-4"
                    title={anime.title}
                    onClick={() => console.log('Selected anime:', anime.title)}
                  >
                    <div class="flex items-center space-x-4">
                      <img
                        src={anime.picture || '/api/placeholder/60/80'}
                        alt={anime.title}
                        class="w-12 h-16 object-cover rounded"
                      />

                      <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2">
                          <h3
                            class={cn(
                              'font-medium truncate',
                              getTextClasses('primary')
                            )}
                          >
                            {anime.title}
                          </h3>
                          <span class={getAnimeTypeColor(anime.type)}>
                            {anime.type}
                          </span>
                          <Show when={anime.favorite}>
                            <span
                              class={cn(getStatusClasses('warning', 'text'))}
                            >
                              ★
                            </span>
                          </Show>
                          <Show when={anime.watched}>
                            <span
                              class={cn(
                                'text-xs px-2 py-1 rounded',
                                getStatusClasses('success', 'bg'),
                                getStatusClasses('success', 'text')
                              )}
                            >
                              Watched
                            </span>
                          </Show>
                        </div>
                        <p class={cn('text-sm', getTextClasses('secondary'))}>
                          {anime.episodes} episodes
                          <Show when={anime.rating}>
                            <span
                              class={cn(
                                'ml-2',
                                getStatusClasses('warning', 'text')
                              )}
                            >
                              ★ {anime.rating}/10
                            </span>
                          </Show>
                        </p>
                        <Show when={anime.synopsis}>
                          <p
                            class={cn(
                              'text-sm mt-1 line-clamp-2',
                              getTextClasses('tertiary')
                            )}
                          >
                            {anime.synopsis}
                          </p>
                        </Show>
                      </div>
                    </div>
                  </MotionCard>
                )}
              />
            </MotionCard>
          </Show>
        </Show>
      </Show>
    </div>
  )
}
