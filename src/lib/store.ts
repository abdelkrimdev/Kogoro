import { createStore } from 'solid-js/store'

/**
 * Anime information structure
 */
export interface Anime {
  id: number
  title: string
  type: 'TV Series' | 'Movie' | 'OVA' | 'Special' | 'ONA' | 'Music'
  episodes: number
  currentEpisodes: number
  startDate?: string
  endDate?: string
  rating?: number
  synopsis?: string
  genres?: string[]
  picture?: string
  watched: boolean
  favorite: boolean
  customTags?: string[]
}

/**
 * Episode information structure
 */
export interface Episode {
  id: number
  animeId: number
  episodeNumber: number
  title?: string
  filePath?: string
  fileSize?: number
  duration?: number
  watched: boolean
  watchDate?: Date
  rating?: number
}

/**
 * File information structure
 */
export interface MediaFile {
  id: string
  path: string
  name: string
  size: number
  extension: string
  duration?: number
  resolution?: string
  videoCodec?: string
  audioCodec?: string
  subtitles?: string[]
  hashes?: {
    ed2k?: string
    md5?: string
    sha1?: string
  }
  animeId?: number
  episodeId?: number
  scannedAt: Date
  lastModified: Date
}

/**
 * Application settings
 */
export interface AppSettings {
  // Directories
  animeDirectories: string[]
  downloadDirectory: string

  // AniDB settings
  anidbClient: string
  anidbPort: number
  anidbUsername?: string
  anidbPassword?: string

  // File naming
  fileNameFormat: string
  createSeasonFolders: boolean

  // UI settings
  theme: 'light' | 'dark' | 'auto'
  language: string
  autoRefresh: boolean
  refreshInterval: number

  // Scanning settings
  autoScan: boolean
  scanInterval: number
  includeSubtitles: boolean
  generateThumbnails: boolean
}

/**
 * Application state structure
 */
export interface AppState {
  // Data
  animeList: Anime[]
  episodes: Episode[]
  mediaFiles: MediaFile[]

  // UI state
  currentView: 'library' | 'search' | 'settings' | 'scanner'
  selectedAnime: Anime | null
  selectedEpisode: Episode | null
  searchQuery: string
  filterGenre: string
  filterType: string
  sortBy: 'title' | 'date' | 'rating' | 'episodes'
  sortOrder: 'asc' | 'desc'

  // Loading states
  isLoading: boolean
  isScanning: boolean
  scanProgress: number

  // Settings
  settings: AppSettings

  // Error handling
  error: string | null
}

/**
 * Default application settings
 */
export const defaultSettings: AppSettings = {
  animeDirectories: [],
  downloadDirectory: '',
  anidbClient: 'kogoro',
  anidbPort: 9001,
  fileNameFormat: '{title} - S{season:02}E{episode:02} - {name}',
  createSeasonFolders: false,
  theme: 'auto',
  language: 'en',
  autoRefresh: true,
  refreshInterval: 300000, // 5 minutes
  autoScan: false,
  scanInterval: 3600000, // 1 hour
  includeSubtitles: true,
  generateThumbnails: true,
}

/**
 * Create initial application state
 */
export function createInitialState(): AppState {
  return {
    animeList: [],
    episodes: [],
    mediaFiles: [],
    currentView: 'library',
    selectedAnime: null,
    selectedEpisode: null,
    searchQuery: '',
    filterGenre: '',
    filterType: '',
    sortBy: 'title',
    sortOrder: 'asc',
    isLoading: false,
    isScanning: false,
    scanProgress: 0,
    settings: defaultSettings,
    error: null,
  }
}

/**
 * Global application store
 */
export const [appState, setAppState] = createStore<AppState>(
  createInitialState()
)

/**
 * Store actions for common operations
 */
export const storeActions = {
  // Anime actions
  addAnime: (anime: Anime) => {
    setAppState('animeList', (list) => [...list, anime])
  },

  updateAnime: (id: number, updates: Partial<Anime>) => {
    setAppState('animeList', (list) =>
      list.map((anime) => (anime.id === id ? { ...anime, ...updates } : anime))
    )
  },

  removeAnime: (id: number) => {
    setAppState('animeList', (list) => list.filter((anime) => anime.id !== id))
    setAppState('selectedAnime', (selected) =>
      selected?.id === id ? null : selected
    )
  },

  // Episode actions
  addEpisode: (episode: Episode) => {
    setAppState('episodes', (list) => [...list, episode])
  },

  updateEpisode: (id: number, updates: Partial<Episode>) => {
    setAppState('episodes', (list) =>
      list.map((episode) =>
        episode.id === id ? { ...episode, ...updates } : episode
      )
    )
  },

  // Media file actions
  addMediaFile: (file: MediaFile) => {
    setAppState('mediaFiles', (list) => [...list, file])
  },

  updateMediaFile: (id: string, updates: Partial<MediaFile>) => {
    setAppState('mediaFiles', (list) =>
      list.map((file) => (file.id === id ? { ...file, ...updates } : file))
    )
  },

  // UI actions
  setCurrentView: (view: AppState['currentView']) => {
    setAppState('currentView', view)
  },

  setSelectedAnime: (anime: Anime | null) => {
    setAppState('selectedAnime', anime)
  },

  setSelectedEpisode: (episode: Episode | null) => {
    setAppState('selectedEpisode', episode)
  },

  setSearchQuery: (query: string) => {
    setAppState('searchQuery', query)
  },

  setFilter: (genre: string, type: string) => {
    setAppState('filterGenre', genre)
    setAppState('filterType', type)
  },

  setSorting: (
    sortBy: AppState['sortBy'],
    sortOrder: AppState['sortOrder']
  ) => {
    setAppState('sortBy', sortBy)
    setAppState('sortOrder', sortOrder)
  },

  // Loading actions
  setLoading: (loading: boolean) => {
    setAppState('isLoading', loading)
  },

  setScanning: (scanning: boolean, progress = 0) => {
    setAppState('isScanning', scanning)
    setAppState('scanProgress', progress)
  },

  // Settings actions
  updateSettings: (updates: Partial<AppSettings>) => {
    setAppState('settings', (settings) => ({ ...settings, ...updates }))
  },

  // Error handling
  setError: (error: string | null) => {
    setAppState('error', error)
  },

  clearError: () => {
    setAppState('error', null)
  },
}

/**
 * Utility functions for working with the store
 */
export const storeUtils = {
  // Get anime by ID
  getAnimeById: (id: number): Anime | undefined => {
    return appState.animeList.find((anime) => anime.id === id)
  },

  // Get episodes by anime ID
  getEpisodesByAnimeId: (animeId: number): Episode[] => {
    return appState.episodes.filter((episode) => episode.animeId === animeId)
  },

  // Get media files by anime ID
  getMediaFilesByAnimeId: (animeId: number): MediaFile[] => {
    return appState.mediaFiles.filter((file) => file.animeId === animeId)
  },

  // Filter anime list
  getFilteredAnime: (): Anime[] => {
    let filtered = [...appState.animeList]

    // Apply search filter
    if (appState.searchQuery) {
      const query = appState.searchQuery.toLowerCase()
      filtered = filtered.filter(
        (anime) =>
          anime.title.toLowerCase().includes(query) ||
          anime.genres?.some((genre) => genre.toLowerCase().includes(query))
      )
    }

    // Apply genre filter
    if (appState.filterGenre) {
      filtered = filtered.filter((anime) =>
        anime.genres?.includes(appState.filterGenre)
      )
    }

    // Apply type filter
    if (appState.filterType) {
      filtered = filtered.filter((anime) => anime.type === appState.filterType)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0

      switch (appState.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'date':
          comparison = (a.startDate || '').localeCompare(b.startDate || '')
          break
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0)
          break
        case 'episodes':
          comparison = a.episodes - b.episodes
          break
      }

      return appState.sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  },
}
