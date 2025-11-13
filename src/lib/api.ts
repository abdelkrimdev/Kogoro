import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

/**
 * AniDB API client configuration
 */
export interface AniDBConfig {
  baseUrl: string
  client: string
  clientVersion: number
  protocolVersion: number
  timeout: number
}

/**
 * AniDB API response structure
 */
export interface AniDBResponse {
  code: number
  message?: string
  data?: any
}

/**
 * AniDB anime information
 */
export interface AniDBAnime {
  id: number
  title: string
  type: 'TV Series' | 'Movie' | 'OVA' | 'Special' | 'ONA' | 'Music'
  episodes: number
  startDate?: string
  endDate?: string
  rating?: number
  synopsis?: string
  genres?: string[]
  picture?: string
}

/**
 * AniDB episode information
 */
export interface AniDBEpisode {
  id: number
  animeId: number
  episodeNumber: number
  title: string
  length?: number
  airDate?: string
  rating?: number
}

/**
 * File information for AniDB matching
 */
export interface FileInfo {
  ed2k: string
  size: number
  md5?: string
  sha1?: string
}

/**
 * AniDB API Client
 */
export class AniDBClient {
  private client: AxiosInstance
  private config: AniDBConfig

  constructor(config: Partial<AniDBConfig> = {}) {
    this.config = {
      baseUrl: 'http://api.anidb.net:9001/httpapi',
      client: 'kogoro',
      clientVersion: 1,
      protocolVersion: 1,
      timeout: 30000,
      ...config,
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/xml',
        Accept: 'application/xml',
      },
    })
  }

  /**
   * Search for anime by file hash
   */
  async searchByHash(fileInfo: FileInfo): Promise<AniDBAnime | null> {
    try {
      const params = new URLSearchParams({
        request: 'hash',
        client: this.config.client,
        clientver: this.config.clientVersion.toString(),
        protover: this.config.protocolVersion.toString(),
        ed2k: fileInfo.ed2k,
        size: fileInfo.size.toString(),
        fmask: '0',
      })

      const response: AxiosResponse = await this.client.get(`?${params}`)
      return this.parseAnimeResponse(response.data)
    } catch (error) {
      console.error('Error searching by hash:', error)
      return null
    }
  }

  /**
   * Search for anime by title
   */
  async searchByTitle(title: string): Promise<AniDBAnime[]> {
    try {
      const params = new URLSearchParams({
        request: 'anime',
        client: this.config.client,
        clientver: this.config.clientVersion.toString(),
        protover: this.config.protocolVersion.toString(),
        animename: title,
        fmask: '0',
      })

      const response: AxiosResponse = await this.client.get(`?${params}`)
      return this.parseAnimeListResponse(response.data)
    } catch (error) {
      console.error('Error searching by title:', error)
      return []
    }
  }

  /**
   * Get anime details by ID
   */
  async getAnimeDetails(animeId: number): Promise<AniDBAnime | null> {
    try {
      const params = new URLSearchParams({
        request: 'anime',
        client: this.config.client,
        clientver: this.config.clientVersion.toString(),
        protover: this.config.protocolVersion.toString(),
        aid: animeId.toString(),
        fmask: '0',
      })

      const response: AxiosResponse = await this.client.get(`?${params}`)
      return this.parseAnimeResponse(response.data)
    } catch (error) {
      console.error('Error getting anime details:', error)
      return null
    }
  }

  /**
   * Parse anime response from XML
   */
  private parseAnimeResponse(xmlData: string): AniDBAnime | null {
    try {
      // Basic XML parsing - in a real implementation, you'd use a proper XML parser
      // For now, this is a simplified version
      const parser = new DOMParser()
      const doc = parser.parseFromString(xmlData, 'text/xml')

      const animeElement = doc.querySelector('anime')
      if (!animeElement) return null

      return {
        id: parseInt(animeElement.getAttribute('id') || '0', 10),
        title: this.getElementText(animeElement, 'title') || '',
        type:
          (this.getElementText(animeElement, 'type') as
            | 'TV Series'
            | 'Movie'
            | 'OVA'
            | 'Special'
            | 'ONA'
            | 'Music') || 'TV Series',
        episodes: parseInt(
          this.getElementText(animeElement, 'episodecount') || '0',
          10
        ),
        startDate: this.getElementText(animeElement, 'startdate') || undefined,
        endDate: this.getElementText(animeElement, 'enddate') || undefined,
        rating: parseFloat(this.getElementText(animeElement, 'rating') || '0'),
        synopsis: this.getElementText(animeElement, 'description') || undefined,
        genres: this.getElementText(animeElement, 'genres')?.split(', ') || [],
        picture: this.getElementText(animeElement, 'picture') || undefined,
      }
    } catch (error) {
      console.error('Error parsing anime response:', error)
      return null
    }
  }

  /**
   * Parse anime list response from XML
   */
  private parseAnimeListResponse(xmlData: string): AniDBAnime[] {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xmlData, 'text/xml')

      const animeElements = doc.querySelectorAll('anime')
      const results: AniDBAnime[] = []

      animeElements.forEach((animeElement) => {
        const anime = this.parseAnimeResponse(animeElement.outerHTML)
        if (anime) {
          results.push(anime)
        }
      })

      return results
    } catch (error) {
      console.error('Error parsing anime list response:', error)
      return []
    }
  }

  /**
   * Helper method to get text content from XML element
   */
  private getElementText(parent: Element, tagName: string): string | null {
    const element = parent.querySelector(tagName)
    return element?.textContent?.trim() || null
  }
}

/**
 * Create a default AniDB client instance
 */
export const anidbClient = new AniDBClient()
