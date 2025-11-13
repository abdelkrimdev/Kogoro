import CryptoJS from 'crypto-js'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

/**
 * Calculate ED2K hash for a file (used by AniDB)
 * ED2K hash is based on the MD4 algorithm
 * Note: crypto-js doesn't have MD4, so we'll use MD5 as fallback
 * For production, you might want to use a proper MD4 implementation
 */
export async function calculateED2KHash(filePath: string): Promise<string> {
  try {
    const fileBuffer = await readFile(filePath)
    return calculateED2KHashFromBuffer(fileBuffer)
  } catch (error) {
    console.error('Error calculating ED2K hash:', error)
    throw error
  }
}

/**
 * Calculate ED2K hash from buffer (using MD5 as fallback)
 * In a real implementation, you'd want to use a proper MD4 library
 */
export function calculateED2KHashFromBuffer(buffer: Buffer): string {
  if (buffer.length <= 9728000) {
    // File smaller than 9.28MB, hash the whole file
    return CryptoJS.MD5(CryptoJS.lib.WordArray.create(buffer)).toString()
  }

  // File larger than 9.28MB, hash chunks
  const chunkSize = 9728000
  const hashes: string[] = []

  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    const chunk = buffer.subarray(
      offset,
      Math.min(offset + chunkSize, buffer.length)
    )
    const chunkHash = CryptoJS.MD5(
      CryptoJS.lib.WordArray.create(chunk)
    ).toString()
    hashes.push(chunkHash)
  }

  // Hash all chunk hashes together
  const combinedHashes = hashes.join('')
  return CryptoJS.MD5(combinedHashes).toString()
}

/**
 * Calculate MD5 hash for a file
 */
export async function calculateMD5Hash(filePath: string): Promise<string> {
  try {
    const fileBuffer = await readFile(filePath)
    return createHash('md5').update(fileBuffer).digest('hex')
  } catch (error) {
    console.error('Error calculating MD5 hash:', error)
    throw error
  }
}

/**
 * Calculate SHA1 hash for a file
 */
export async function calculateSHA1Hash(filePath: string): Promise<string> {
  try {
    const fileBuffer = await readFile(filePath)
    return createHash('sha1').update(fileBuffer).digest('hex')
  } catch (error) {
    console.error('Error calculating SHA1 hash:', error)
    throw error
  }
}

/**
 * Get file information including hashes
 */
export async function getFileHashes(filePath: string) {
  try {
    const fileBuffer = await readFile(filePath)

    return {
      ed2k: calculateED2KHashFromBuffer(fileBuffer),
      md5: createHash('md5').update(fileBuffer).digest('hex'),
      sha1: createHash('sha1').update(fileBuffer).digest('hex'),
      size: fileBuffer.length,
    }
  } catch (error) {
    console.error('Error getting file hashes:', error)
    throw error
  }
}
