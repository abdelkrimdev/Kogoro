/**
 * Application configuration constants
 */

/**
 * Application metadata
 */
export const APP_CONFIG = {
  name: 'Kogoro',
  version: '0.0.1',
  description:
    'Ultimate companion for organizing and renaming your anime collection',
  author: 'Kogoro Team',
  repository: 'https://github.com/kogoro/kogoro',
  homepage: 'https://kogoro.app',
} as const

/**
 * AniDB API configuration
 */
export const ANIDB_CONFIG = {
  baseUrl: 'http://api.anidb.net:9001/httpapi',
  udpUrl: 'udp://api.anidb.net:9000',
  defaultClient: 'kogoro',
  defaultVersion: 1,
  protocolVersion: 1,
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,

  // Rate limiting (AniDB allows 2 requests per second)
  rateLimit: {
    requestsPerSecond: 2,
    burstLimit: 5,
  },
} as const

/**
 * File system configuration
 */
export const FILESYSTEM_CONFIG = {
  // Supported video formats
  supportedVideoFormats: [
    '.mp4',
    '.mkv',
    '.avi',
    '.mov',
    '.wmv',
    '.flv',
    '.webm',
    '.m4v',
    '.mpg',
    '.mpeg',
  ],

  // Supported subtitle formats
  supportedSubtitleFormats: ['.srt', '.ass', '.ssa', '.vtt', '.sub', '.idx'],

  // Supported image formats for artwork
  supportedImageFormats: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],

  // File size limits (in bytes)
  maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
  minFileSize: 1024 * 1024, // 1MB

  // Chunk size for hashing large files
  hashChunkSize: 9728000, // 9.28MB (AniDB standard)

  // Directory watching
  watchDebounce: 1000, // 1 second
  maxWatchers: 10,
} as const

/**
 * UI configuration
 */
export const UI_CONFIG = {
  // Theme
  themes: ['light', 'dark', 'auto'] as const,
  defaultTheme: 'light',

  // Layout
  sidebarWidth: 280,
  sidebarCollapsedWidth: 60,
  headerHeight: 64,
  footerHeight: 48,

  // Grid view
  gridColumns: {
    xs: 2,
    sm: 3,
    md: 4,
    lg: 5,
    xl: 6,
    '2xl': 8,
  },

  // List view
  listItemHeight: 80,

  // Animations
  animationDuration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // Pagination
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
} as const

/**
 * Storage configuration
 */
export const STORAGE_CONFIG = {
  // Local storage keys
  keys: {
    settings: 'kogoro-settings',
    theme: 'kogoro-theme',
    lastScan: 'kogoro-last-scan',
    watchHistory: 'kogoro-watch-history',
    favorites: 'kogoro-favorites',
  },

  // Cache configuration
  cache: {
    animeInfo: 24 * 60 * 60 * 1000, // 24 hours
    episodeInfo: 24 * 60 * 60 * 1000, // 24 hours
    images: 7 * 24 * 60 * 60 * 1000, // 7 days
    thumbnails: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
} as const

/**
 * Development configuration
 */
export const DEV_CONFIG = {
  // Feature flags
  features: {
    debugMode: false,
    mockApi: false,
    enableLogs: true,
    enableAnalytics: false,
  },

  // Logging
  logLevel: 'info' as const, // 'debug' | 'info' | 'warn' | 'error'

  // API endpoints
  apiEndpoints: {
    development: 'http://localhost:3001/api',
    staging: 'https://staging-api.kogoro.app',
    production: 'https://api.kogoro.app',
  },
} as const

/**
 * Environment detection
 */
export const isDevelopment = import.meta.env.DEV
export const isProduction = import.meta.env.PROD
export const isTest = import.meta.env.MODE === 'test'

/**
 * Get current API endpoint
 */
export function getApiEndpoint(): string {
  if (isDevelopment) return DEV_CONFIG.apiEndpoints.development
  if (isTest) return DEV_CONFIG.apiEndpoints.staging
  return DEV_CONFIG.apiEndpoints.production
}

/**
 * File naming patterns
 */
export const FILE_NAMING_PATTERNS = {
  default: '{title} - S{season:02}E{episode:02} - {name}',
  simple: '{title} - {episode:02}',
  detailed: '{title} - Season {season} Episode {episode} - {name}',
  withDate: '{title} - {episode:02} - {name} ({date})',
  custom: '',
} as const

/**
 * Regular expressions for parsing filenames
 */
export const FILENAME_PATTERNS = {
  // Standard patterns
  episodeNumber: /(?:ep|episode|s\d+e)(\d+)/i,
  seasonEpisode: /s(\d+)e(\d+)/i,
  justNumber: /(\d+)\.?(?:mp4|mkv|avi|mov|wmv|flv|webm|m4v)$/i,

  // Anime-specific patterns
  animeTitle: /^(.+?)(?:[-_]\s*(?:s\d+e\d+|ep\d+|\d+))/i,
  releaseGroup: /^\[([^\]]+)\]/i,
  videoQuality: /(?:1080|720|480)p/i,
  videoCodec: /(x264|x265|h\.264|h\.265|hevc)/i,
  audioCodec: /(aac|ac3|dts|flac|mp3)/i,
} as const

/**
 * Default directories (platform-specific)
 */
export const DEFAULT_DIRECTORIES = {
  // Windows
  win32: {
    videos: 'C:\\Users\\{username}\\Videos',
    downloads: 'C:\\Users\\{username}\\Downloads',
    documents: 'C:\\Users\\{username}\\Documents',
  },

  // macOS
  darwin: {
    videos: '/Users/{username}/Movies',
    downloads: '/Users/{username}/Downloads',
    documents: '/Users/{username}/Documents',
  },

  // Linux
  linux: {
    videos: '/home/{username}/Videos',
    downloads: '/home/{username}/Downloads',
    documents: '/home/{username}/Documents',
  },
} as const

/**
 * Get platform-specific default directory
 */
export function getDefaultDirectory(
  type: keyof typeof DEFAULT_DIRECTORIES.win32
): string {
  const platform = typeof window !== 'undefined' ? 'win32' : process.platform
  const dirs =
    DEFAULT_DIRECTORIES[platform as keyof typeof DEFAULT_DIRECTORIES] ||
    DEFAULT_DIRECTORIES.linux
  const username =
    typeof window !== 'undefined' ? 'user' : process.env.USER || 'user'

  return dirs[type].replace('{username}', username)
}
