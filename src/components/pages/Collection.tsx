import { type Component, For, Show, createSignal } from 'solid-js'
import {
  Grid3x3 as Grid,
  List,
  Filter,
  ArrowUpDown as SortAsc,
  Search,
} from 'lucide-solid'
import { appState, storeUtils, storeActions } from '../../lib/store'

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
    const colors = {
      'TV Series':
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      Movie:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      OVA: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      Special:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      ONA: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
      Music:
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    }
    return colors[type as keyof typeof colors] || colors['TV Series']
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            Collection
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-2">
            Browse and manage your anime collection
          </p>
        </div>

        {/* View Controls */}
        <div class="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters())}
            class={`p-2 rounded-lg transition-colors ${
              showFilters()
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
            title="Toggle filters"
          >
            <Filter class="w-5 h-5" />
          </button>

          <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              class={`p-2 rounded transition-colors ${
                viewMode() === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="Grid view"
            >
              <Grid class="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              class={`p-2 rounded transition-colors ${
                viewMode() === 'list'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="List view"
            >
              <List class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Show when={showFilters()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort By
              </label>
              <select
                value={sortBy()}
                onChange={(e) => handleSort(e.target.value as SortBy)}
                class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                <option value="title">Title</option>
                <option value="date">Start Date</option>
                <option value="rating">Rating</option>
                <option value="episodes">Episodes</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Order
              </label>
              <button
                onClick={() =>
                  setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')
                }
                class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white flex items-center justify-center space-x-2"
              >
                <SortAsc
                  class={`w-4 h-4 ${sortOrder() === 'desc' ? 'rotate-180' : ''}`}
                />
                <span>
                  {sortOrder() === 'asc' ? 'Ascending' : 'Descending'}
                </span>
              </button>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type
              </label>
              <select
                value={appState.filterType}
                onChange={(e) =>
                  storeActions.setFilter(appState.filterGenre, e.target.value)
                }
                class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
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
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredAnime().length} anime
        </p>
      </div>

      {/* Collection Content */}
      <Show
        when={filteredAnime().length > 0}
        fallback={
          <div class="text-center py-12">
            <Search class="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No anime found
            </h3>
            <p class="text-gray-600 dark:text-gray-400">
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
                  <div class="relative rounded-lg overflow-hidden mb-3 aspect-[3/4] bg-gray-200 dark:bg-gray-700">
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
                      <span
                        class={`inline-block px-2 py-1 text-xs font-medium rounded ${getAnimeTypeColor(anime.type)}`}
                      >
                        {anime.type}
                      </span>
                    </div>

                    <Show when={anime.favorite}>
                      <div class="absolute top-2 right-2">
                        <div class="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                          <span class="text-white text-sm">★</span>
                        </div>
                      </div>
                    </Show>

                    <Show when={anime.watched}>
                      <div class="absolute bottom-2 right-2">
                        <div class="bg-green-500 text-white text-xs px-2 py-1 rounded">
                          Watched
                        </div>
                      </div>
                    </Show>
                  </div>

                  <div>
                    <h3 class="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {anime.title}
                    </h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {anime.episodes} episodes
                    </p>
                    <Show when={anime.rating}>
                      <div class="flex items-center mt-1">
                        <span class="text-yellow-500 text-sm">★</span>
                        <span class="text-sm text-gray-600 dark:text-gray-400 ml-1">
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
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div class="divide-y divide-gray-200 dark:divide-gray-700">
              <For each={filteredAnime()}>
                {(anime) => (
                  <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <div class="flex items-center space-x-4">
                      <img
                        src={anime.picture || '/api/placeholder/60/80'}
                        alt={anime.title}
                        class="w-12 h-16 object-cover rounded"
                      />

                      <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2">
                          <h3 class="font-medium text-gray-900 dark:text-white truncate">
                            {anime.title}
                          </h3>
                          <span
                            class={`inline-block px-2 py-1 text-xs font-medium rounded ${getAnimeTypeColor(anime.type)}`}
                          >
                            {anime.type}
                          </span>
                          <Show when={anime.favorite}>
                            <span class="text-yellow-500">★</span>
                          </Show>
                          <Show when={anime.watched}>
                            <span class="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs px-2 py-1 rounded">
                              Watched
                            </span>
                          </Show>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                          {anime.episodes} episodes
                          <Show when={anime.rating}>
                            <span class="ml-2">★ {anime.rating}/10</span>
                          </Show>
                        </p>
                        <Show when={anime.synopsis}>
                          <p class="text-sm text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
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
