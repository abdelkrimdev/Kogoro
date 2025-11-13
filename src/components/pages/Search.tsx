import { type Component, For, Show } from 'solid-js'
import { Search as SearchIcon, ExternalLink, Star } from 'lucide-solid'

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

  const getStatusColor = (status: string) => {
    const colors = {
      completed:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      ongoing:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      upcoming:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    }
    return colors[status as keyof typeof colors] || colors.ongoing
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Search</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          Search for anime online and add them to your collection
        </p>
      </div>

      {/* Search Form */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex space-x-4">
          <div class="flex-1 relative">
            <SearchIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for anime by title, genre, or keyword..."
              class="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <button class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2">
            <SearchIcon class="w-5 h-5" />
            <span>Search</span>
          </button>
        </div>

        {/* Search Filters */}
        <div class="mt-4 flex flex-wrap gap-2">
          <select class="px-3 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white">
            <option>All Types</option>
            <option>TV Series</option>
            <option>Movie</option>
            <option>OVA</option>
          </select>

          <select class="px-3 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white">
            <option>All Years</option>
            <option>2023</option>
            <option>2022</option>
            <option>2021</option>
          </select>

          <select class="px-3 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white">
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
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            Search Results
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Found {searchResults.length} results
          </p>
        </div>

        <Show
          when={searchResults.length > 0}
          fallback={
            <div class="text-center py-12">
              <SearchIcon class="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No results found
              </h3>
              <p class="text-gray-600 dark:text-gray-400">
                Try adjusting your search terms or filters
              </p>
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <For each={searchResults}>
              {(result) => (
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden group cursor-pointer">
                  <div class="relative">
                    <img
                      src={result.image}
                      alt={result.title}
                      class="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div class="absolute top-2 left-2">
                      <span
                        class={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusColor(result.status)}`}
                      >
                        {result.status}
                      </span>
                    </div>
                    <div class="absolute top-2 right-2">
                      <span class="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                        {result.year}
                      </span>
                    </div>
                  </div>

                  <div class="p-4">
                    <div class="flex items-start justify-between mb-2">
                      <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                        {result.title}
                      </h3>
                      <div class="flex items-center ml-2">
                        <Star class="w-4 h-4 text-yellow-500 fill-current" />
                        <span class="text-sm text-gray-600 dark:text-gray-400 ml-1">
                          {result.rating}
                        </span>
                      </div>
                    </div>

                    <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <span>{result.type}</span>
                      <span>{result.episodes} eps</span>
                    </div>

                    <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                      {result.synopsis}
                    </p>

                    <div class="flex flex-wrap gap-1 mb-3">
                      <For each={result.genres}>
                        {(genre) => (
                          <span class="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 rounded">
                            {genre}
                          </span>
                        )}
                      </For>
                    </div>

                    <div class="flex space-x-2">
                      <button class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                        Add to Collection
                      </button>
                      <button class="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
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
