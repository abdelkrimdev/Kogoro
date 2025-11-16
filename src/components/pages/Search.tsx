import { type Component, For, Show } from 'solid-js'
import { Search as SearchIcon, ExternalLink, Star } from 'lucide-solid'
import {
  cn,
  getStatusClasses,
  getThemeComponentClasses,
  getBackgroundClasses,
  getTextClasses,
  getBorderClasses,
} from '@/lib/utils'

export const Search: Component = () => {
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

  return (
    <div class="space-y-6">
      {/* Header */}
      <div>
        <h1 class={cn('text-3xl font-bold', getTextClasses('primary'))}>
          Search
        </h1>
        <p class={cn('mt-2', getTextClasses('secondary'))}>
          Search for anime online and add them to your collection
        </p>
      </div>

      {/* Search Form */}
      <div
        class={cn(
          getThemeComponentClasses({ variant: 'default', interactive: false }),
          'p-6 shadow-sm'
        )}
      >
        <div class="flex space-x-4">
          <div class="flex-1 relative">
            <SearchIcon
              class={cn(
                'absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5',
                getTextClasses('tertiary')
              )}
            />
            <input
              type="text"
              placeholder="Search for anime by title, genre, or keyword..."
              class={cn(
                'w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus-ring transition-colors',
                getBackgroundClasses('tertiary'),
                getBorderClasses('secondary'),
                getTextClasses('primary'),
                'placeholder:text-muted-foreground'
              )}
            />
          </div>
          <button
            type="button"
            class={cn(
              'px-6 py-3 rounded-lg transition-colors flex items-center space-x-2',
              'bg-accent text-accent-foreground hover:bg-accent-hover focus-ring'
            )}
          >
            <SearchIcon class="w-5 h-5" />
            <span>Search</span>
          </button>
        </div>

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
      </div>

      {/* Search Results */}
      <div>
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
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <For each={searchResults}>
              {(result) => (
                <div
                  class={cn(
                    getThemeComponentClasses({
                      variant: 'default',
                      interactive: false,
                    }),
                    'shadow-sm overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-[1.02]'
                  )}
                >
                  <div class="relative">
                    <img
                      src={result.image}
                      alt={result.title}
                      class="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div class="absolute top-2 left-2">
                      <span class={getStatusBadgeClasses(result.status)}>
                        {result.status}
                      </span>
                    </div>
                    <div class="absolute top-2 right-2">
                      <span class="bg-black/75 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                        {result.year}
                      </span>
                    </div>
                  </div>

                  <div class="p-4">
                    <div class="flex items-start justify-between mb-2">
                      <h3
                        class={cn(
                          'font-semibold line-clamp-2 transition-colors',
                          getTextClasses('primary'),
                          'group-hover:text-accent'
                        )}
                      >
                        {result.title}
                      </h3>
                      <div class="flex items-center ml-2">
                        <Star class="w-4 h-4 text-yellow-500 fill-current" />
                        <span
                          class={cn(
                            'text-sm ml-1',
                            getTextClasses('secondary')
                          )}
                        >
                          {result.rating}
                        </span>
                      </div>
                    </div>

                    <div
                      class={cn(
                        'flex items-center space-x-4 text-sm mb-3',
                        getTextClasses('secondary')
                      )}
                    >
                      <span>{result.type}</span>
                      <span>{result.episodes} eps</span>
                    </div>

                    <p
                      class={cn(
                        'text-sm line-clamp-3 mb-3',
                        getTextClasses('secondary')
                      )}
                    >
                      {result.synopsis}
                    </p>

                    <div class="flex flex-wrap gap-1 mb-3">
                      <For each={result.genres}>
                        {(genre) => (
                          <span
                            class={cn(
                              'inline-block px-2 py-1 text-xs rounded transition-colors',
                              getBackgroundClasses('tertiary'),
                              getTextClasses('secondary')
                            )}
                          >
                            {genre}
                          </span>
                        )}
                      </For>
                    </div>

                    <div class="flex space-x-2">
                      <button
                        type="button"
                        class={cn(
                          'flex-1 px-3 py-2 text-sm rounded-lg transition-colors focus-ring',
                          'bg-accent text-accent-foreground hover:bg-accent-hover'
                        )}
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
                      >
                        <ExternalLink class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}
