/**
 * Bun-specific utilities and optimizations
 * This file contains functions that leverage Bun's native capabilities
 */

// Type declaration for Bun global (available in Bun runtime)
declare const Bun: {
  file(path: string): {
    arrayBuffer(): Promise<ArrayBuffer>
    size: number
    lastModified: number
    type: string
    exists(): Promise<boolean>
  }
  write(path: string, data: string | Uint8Array): Promise<void>
}

/**
 * Bun-optimized file reading with built-in performance improvements
 */
export async function readFileOptimized(filePath: string): Promise<Uint8Array> {
  try {
    // Use Bun's native file reading which is optimized for performance
    const file = Bun.file(filePath)
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  } catch (error) {
    console.error(
      `Error reading file ${filePath} with Bun optimization:`,
      error
    )
    // Fallback to standard Node.js fs if Bun-specific API fails
    const { readFile } = await import('node:fs/promises')
    return readFile(filePath)
  }
}

/**
 * Calculate file hash using Bun's built-in crypto utilities
 */
export async function calculateFileHash(
  filePath: string,
  algorithm: 'md5' | 'sha1' | 'sha256' = 'md5'
): Promise<string> {
  try {
    // Use Bun's built-in crypto which is faster than Node.js crypto
    const file = Bun.file(filePath)
    const buffer = await file.arrayBuffer()

    // Use Web Crypto API which Bun provides natively
    const hashAlgorithm =
      algorithm === 'md5' ? 'MD5' : algorithm === 'sha1' ? 'SHA-1' : 'SHA-256'
    const hashBuffer = await crypto.subtle.digest(hashAlgorithm, buffer)

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch (error) {
    console.error(
      `Error calculating ${algorithm} hash with Bun optimization:`,
      error
    )
    // Fallback to Node.js crypto
    const { createHash } = await import('node:crypto')
    const { readFile } = await import('node:fs/promises')
    const fileBuffer = await readFile(filePath)
    return createHash(algorithm).update(fileBuffer).digest('hex')
  }
}

/**
 * Bun-optimized HTTP client using native fetch
 */
export class BunHttpClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl: string = '', timeout: number = 30000) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  async get(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = this.baseUrl ? `${this.baseUrl}${endpoint}` : endpoint

    return fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(this.timeout),
      ...options,
    })
  }

  async post(
    endpoint: string,
    data?: BodyInit,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = this.baseUrl ? `${this.baseUrl}${endpoint}` : endpoint

    const requestOptions: RequestInit = {
      method: 'POST',
      signal: AbortSignal.timeout(this.timeout),
      ...options,
    }

    if (data !== undefined) {
      requestOptions.body = data
    }

    return fetch(url, requestOptions)
  }

  async put(
    endpoint: string,
    data?: BodyInit,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = this.baseUrl ? `${this.baseUrl}${endpoint}` : endpoint

    const requestOptions: RequestInit = {
      method: 'PUT',
      signal: AbortSignal.timeout(this.timeout),
      ...options,
    }

    if (data !== undefined) {
      requestOptions.body = data
    }

    return fetch(url, requestOptions)
  }

  async delete(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = this.baseUrl ? `${this.baseUrl}${endpoint}` : endpoint

    return fetch(url, {
      method: 'DELETE',
      signal: AbortSignal.timeout(this.timeout),
      ...options,
    })
  }
}

/**
 * Create a default Bun HTTP client instance
 */
export const bunHttpClient = new BunHttpClient()

/**
 * Bun-optimized file system operations
 */
export const BunFileSystem = {
  /**
   * Get file size and metadata using Bun's optimized APIs
   */
  async getFileInfo(filePath: string) {
    try {
      const file = Bun.file(filePath)
      const exists = await file.exists()

      if (!exists) {
        return null
      }

      return {
        size: file.size,
        lastModified: file.lastModified,
        type: file.type,
      }
    } catch (error) {
      console.error(`Error getting file info for ${filePath}:`, error)
      return null
    }
  },

  /**
   * Write file using Bun's optimized file writing
   */
  async writeFile(filePath: string, data: string | Uint8Array): Promise<void> {
    try {
      await Bun.write(filePath, data)
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error)
      throw error
    }
  },

  /**
   * Check if file exists using Bun's optimized API
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const file = Bun.file(filePath)
      return await file.exists()
    } catch (_error) {
      return false
    }
  },
}

// Performance monitoring state
const performanceTimers: Map<string, number> = new Map()

/**
 * Performance monitoring utilities for Bun
 */
export const BunPerformance = {
  /**
   * Start timing an operation
   */
  start(name: string): void {
    performanceTimers.set(name, performance.now())
  },

  /**
   * End timing and return duration
   */
  end(name: string): number {
    const startTime = performanceTimers.get(name)
    if (!startTime) {
      console.warn(`Timer '${name}' was not started`)
      return 0
    }

    const duration = performance.now() - startTime
    performanceTimers.delete(name)
    console.log(`⚡ ${name}: ${duration.toFixed(2)}ms`)
    return duration
  },

  /**
   * Measure async function execution time
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name)
    try {
      const result = await fn()
      this.end(name)
      return result
    } catch (error) {
      this.end(name)
      throw error
    }
  },
}
