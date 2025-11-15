import {
  readFile,
  readdir,
  stat,
  mkdir,
  rename,
  unlink,
} from 'node:fs/promises'
import { join, extname, basename, dirname } from 'node:path'
import { type FSWatcher, watch } from 'chokidar'
import { EventEmitter } from 'node:events'

/**
 * Supported video file extensions
 */
export const SUPPORTED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.mkv',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v',
]

/**
 * File information structure
 */
export interface FileInfo {
  path: string
  name: string
  size: number
  extension: string
  createdAt: Date
  modifiedAt: Date
  isDirectory: boolean
}

/**
 * Directory scan options
 */
export interface ScanOptions {
  recursive?: boolean
  includeDirectories?: boolean
  filter?: (fileInfo: FileInfo) => boolean
}

/**
 * File watcher events
 */
export interface FileWatcherEvents {
  add: (path: string) => void
  change: (path: string) => void
  unlink: (path: string) => void
  addDir: (path: string) => void
  unlinkDir: (path: string) => void
  error: (error: Error) => void
}

/**
 * File system utility class
 */
export class FileSystemManager extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map()

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await stat(filePath)
      return {
        path: filePath,
        name: basename(filePath),
        size: stats.size,
        extension: extname(filePath).toLowerCase(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isDirectory: stats.isDirectory(),
      }
    } catch (error) {
      console.error(`Error getting file info for ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Scan directory for files
   */
  async scanDirectory(
    directoryPath: string,
    options: ScanOptions = {}
  ): Promise<FileInfo[]> {
    const { recursive = true, includeDirectories = false, filter } = options

    try {
      const files: FileInfo[] = []
      const entries = await readdir(directoryPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(directoryPath, entry.name)
        const fileInfo = await this.getFileInfo(fullPath)

        // Apply filter if provided
        if (filter && !filter(fileInfo)) {
          continue
        }

        // Include directories if requested
        if (entry.isDirectory()) {
          if (includeDirectories) {
            files.push(fileInfo)
          }

          // Recursively scan subdirectories
          if (recursive) {
            const subFiles = await this.scanDirectory(fullPath, options)
            files.push(...subFiles)
          }
        } else {
          files.push(fileInfo)
        }
      }

      return files
    } catch (error) {
      console.error(`Error scanning directory ${directoryPath}:`, error)
      throw error
    }
  }

  /**
   * Scan for video files only
   */
  async scanForVideos(
    directoryPath: string,
    recursive = true
  ): Promise<FileInfo[]> {
    return this.scanDirectory(directoryPath, {
      recursive,
      includeDirectories: false,
      filter: (fileInfo) =>
        SUPPORTED_VIDEO_EXTENSIONS.includes(fileInfo.extension),
    })
  }

  /**
   * Check if file is a video
   */
  isVideoFile(filePath: string): boolean {
    const extension = extname(filePath).toLowerCase()
    return SUPPORTED_VIDEO_EXTENSIONS.includes(extension)
  }

  /**
   * Create directory if it doesn't exist
   */
  async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true })
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error)
      throw error
    }
  }

  /**
   * Rename/move file
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      // Ensure target directory exists
      await this.ensureDirectoryExists(dirname(newPath))
      await rename(oldPath, newPath)
    } catch (error) {
      console.error(`Error renaming file from ${oldPath} to ${newPath}:`, error)
      throw error
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath)
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Read file content as buffer
   */
  async readFileAsBuffer(filePath: string): Promise<Buffer> {
    try {
      return await readFile(filePath)
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Watch directory for changes
   */
  watchDirectory(directoryPath: string): void {
    if (this.watchers.has(directoryPath)) {
      return // Already watching this directory
    }

    const watcher = watch(directoryPath, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
    })

    watcher
      .on('add', (filePath) => this.emit('add', filePath))
      .on('change', (filePath) => this.emit('change', filePath))
      .on('unlink', (filePath) => this.emit('unlink', filePath))
      .on('addDir', (dirPath) => this.emit('addDir', dirPath))
      .on('unlinkDir', (dirPath) => this.emit('unlinkDir', dirPath))
      .on('error', (error) => this.emit('error', error))

    this.watchers.set(directoryPath, watcher)
  }

  /**
   * Stop watching directory
   */
  unwatchDirectory(directoryPath: string): void {
    const watcher = this.watchers.get(directoryPath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(directoryPath)
    }
  }

  /**
   * Stop watching all directories
   */
  unwatchAll(): void {
    for (const [, watcher] of this.watchers) {
      watcher.close()
    }
    this.watchers.clear()
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.unwatchAll()
    this.removeAllListeners()
  }
}

/**
 * Create a default file system manager instance
 */
export const fileSystemManager = new FileSystemManager()

/**
 * Utility function to format file names for anime
 */
export function formatAnimeFileName(
  animeTitle: string,
  episodeNumber: number,
  extension: string,
  episodeTitle?: string
): string {
  const paddedEpisode = episodeNumber.toString().padStart(2, '0')
  const baseName = `${animeTitle} - ${paddedEpisode}`

  if (episodeTitle) {
    return `${baseName} - ${episodeTitle}${extension}`
  }

  return `${baseName}${extension}`
}

/**
 * Utility function to parse episode number from filename
 */
export function parseEpisodeNumber(fileName: string): number | null {
  // Common patterns for episode numbers
  const patterns = [
    /(?:ep|episode|s\d+e)(\d+)/i,
    /(\d+)\.?(?:mp4|mkv|avi|mov|wmv|flv|webm|m4v)$/i,
    /[-_]\s*(\d+)\s*[-_]/,
    /(\d+)$/i,
  ]

  for (const pattern of patterns) {
    const match = fileName.match(pattern)
    if (match?.[1]) {
      const num = parseInt(match[1], 10)
      if (!Number.isNaN(num) && num > 0 && num < 1000) {
        return num
      }
    }
  }

  return null
}
