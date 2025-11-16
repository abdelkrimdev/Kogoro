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

type ViewMode = 'grid' | 'list'
type SortBy = 'title' | 'date' | 'rating' | 'episodes'
type SortOrder = 'asc' | 'desc'

export const Collection: Component = () => {
  const [viewMode, setViewMode] = createSignal<ViewMode>('grid')
  const [sortBy, setSortBy] = createSignal<SortBy>('title')
  const [sortOrder, setSortOrder] = createSignal<SortOrder>('asc')
  const [showFilters, setShowFilters] = createSignal(false)

  const filteredAnime = () => storeUtils.getFilteredAnime()

  const handleSort = (newSortBy: SortBy) => {
    if (sortBy() === newSortBy) {
      setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('asc')
    }
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
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
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
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters())}
            class={cn(
              'p-2 rounded-lg transition-colors',
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
          </button>

          <div
            class={cn(
              'flex items-center rounded-lg p-1',
              getBackgroundClasses('secondary')
            )}
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
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
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
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
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Show when={showFilters()}>
        <div
          class={cn(
            getThemeComponentClasses({
              variant: 'default',
              interactive: false,
            }),
            'p-4'
          )}
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
        </div>
      </Show>

      {/* Results Count */}
      <div class="flex items-center justify-between">
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
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <For each={filteredAnime()}>
              {(anime) => (
                <div class="group cursor-pointer">
                  <div
                    class={cn(
                      'relative rounded-lg overflow-hidden mb-3 aspect-[3/4]',
                      getBackgroundClasses('tertiary')
                    )}
                  >
                    <img
                      src={anime.picture || '/api/placeholder/300/400'}
                      alt={anime.title}
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-300 flex items-center justify-center">
                      <div class="text-white text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div class="bg-black bg-opacity-75 rounded-lg px-3 py-2">
                          <p class="text-sm">Watch Now</p>
                        </div>
                      </div>
                    </div>

                    {/* Badges */}
                    <div class="absolute top-2 left-2">
                      <span class={getAnimeTypeColor(anime.type)}>
                        {anime.type}
                      </span>
                    </div>

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

                    <Show when={anime.watched}>
                      <div class="absolute bottom-2 right-2">
                        <div
                          class={cn(
                            'text-xs px-2 py-1 rounded',
                            getStatusClasses('success', 'bg'),
                            getStatusClasses('success', 'text')
                          )}
                        >
                          Watched
                        </div>
                      </div>
                    </Show>
                  </div>

                  <div>
                    <h3
                      class={cn(
                        'font-medium truncate transition-colors',
                        getTextClasses('primary'),
                        'group-hover:text-accent'
                      )}
                    >
                      {anime.title}
                    </h3>
                    <p class={cn('text-sm', getTextClasses('secondary'))}>
                      {anime.episodes} episodes
                    </p>
                    <Show when={anime.rating}>
                      <div class="flex items-center mt-1">
                        <span
                          class={cn(
                            'text-sm',
                            getStatusClasses('warning', 'text')
                          )}
                        >
                          ★
                        </span>
                        <span
                          class={cn(
                            'text-sm ml-1',
                            getTextClasses('secondary')
                          )}
                        >
                          {anime.rating}/10
                        </span>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* List View */}
        <Show when={viewMode() === 'list'}>
          <div
            class={cn(
              getThemeComponentClasses({
                variant: 'default',
                interactive: false,
              })
            )}
          >
            <div class={cn('divide-y', getBorderClasses('secondary'))}>
              <For each={filteredAnime()}>
                {(anime) => (
                  <div
                    class={cn(
                      'p-4 transition-colors cursor-pointer',
                      'hover:bg-muted'
                    )}
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
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  )
}
