/**
 * Main library exports for Kogoro
 */

// Utility functions
export * from './utils'

// File system operations
export {
  FileSystemManager,
  fileSystemManager,
  formatAnimeFileName,
  parseEpisodeNumber,
  SUPPORTED_VIDEO_EXTENSIONS,
  type ScanOptions,
  type FileWatcherEvents,
} from './filesystem'

// File hashing
export * from './hashing'

// API client
export {
  AniDBClient,
  anidbClient,
  type AniDBConfig,
  type AniDBResponse,
  type AniDBAnime,
  type AniDBEpisode,
  type FileInfo,
} from './api'

// Store management
export * from './store'

// Configuration
export * from './config'

// Motion and animations
export {
  initializeMotion,
  getMotionState,
  isMotionEnabled,
  getDuration,
  getEasing,
  getDelay,
  MOTION_PRESETS,
  THEME_MOTION_VARIANTS,
  createMotionPreset,
  getThemeMotion,
  MOTION_CSS,
  MOTION_KEYFRAMES,
  createMotion,
  type MotionPreset,
  type MotionDuration,
  type MotionEasing,
  type MotionDelay,
  type ThemeMotionVariant,
} from './motion'
