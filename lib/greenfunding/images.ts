import { createHash } from 'node:crypto'

// Copies a campaign's images into our own storage (bucket greenfunding-products,
// folder campaign-<id>/). The original bytes are kept (no re-encoding). Each
// image's original URL is recorded so a re-sync never uploads it twice.

export const IMAGE_BUCKET = 'greenfunding-products'
const MAX_BYTES = 20 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }

export type ImageDeps = {
  fetch: typeof fetch
  // Uploads bytes; must succeed silently if the object already exists.
  upload: (path: string, bytes: Uint8Array, contentType: string) => Promise<void>
  publicUrl: (path: string) => string
  // Original URLs already stored for this product.
  existing: Set<string>
  delayMs: number
  timeoutMs: number
  userAgent: string
}

export type ImportedImage = { originalUrl: string; storagePath: string; publicUrl: string; width: number | null; height: number | null; position: number }

// Errors that will never succeed on retry (the image itself is unusable).
export class PermanentImageError extends Error {}

// Storage path for an image: hero.<ext> for a product's very first image,
// otherwise a short hash of the original URL (stable, so the same image always
// maps to the same file and never collides with an existing one).
export function imagePath(campaignId: string, originalUrl: string, index: number, ext: string, isFirstImage = index === 0) {
  const name = isFirstImage ? 'hero' : `image-${createHash('sha1').update(originalUrl).digest('hex').slice(0, 12)}`
  return `campaign-${campaignId}/${name}.${ext}`
}

// Reads width/height from PNG, GIF, JPEG and WebP headers (null if unknown).
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const u16 = (o: number) => (b[o] << 8) | b[o + 1]
  const u16le = (o: number) => b[o] | (b[o + 1] << 8)
  const u24le = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)
  if (b[0] === 0x89 && b[1] === 0x50 && b.length > 24) return { width: (u16(16) << 16) | u16(18), height: (u16(20) << 16) | u16(22) }
  if (b[0] === 0x47 && b[1] === 0x49 && b.length > 10) return { width: u16le(6), height: u16le(8) }
  if (b[0] === 0x52 && b[8] === 0x57 && b.length > 30) {
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (kind === 'VP8X') return { width: u24le(24) + 1, height: u24le(27) + 1 }
    if (kind === 'VP8 ') return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff }
    if (kind === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) return null
      const marker = b[o + 1]
      const len = u16(o + 2)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: u16(o + 7), height: u16(o + 5) }
      o += 2 + len
    }
  }
  return null
}

// The real format from the file's first bytes (servers don't always send a
// Content-Type). A declared type that disagrees with the bytes is rejected.
export function sniffImageType(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69) return 'image/avif'
  return null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function importImages(
  campaignId: string,
  urls: string[],
  deps: ImageDeps,
  startPosition = 0,
): Promise<{ imported: ImportedImage[]; skipped: number; errors: string[]; unusable: string[] }> {
  const imported: ImportedImage[] = []
  const errors: string[] = []
  const unusable: string[] = []
  let skipped = 0
  let position = startPosition
  for (const [index, originalUrl] of urls.entries()) {
    if (deps.existing.has(originalUrl)) {
      skipped++
      continue
    }
    try {
      if (index > 0 || imported.length > 0) await sleep(deps.delayMs)
      const res = await deps.fetch(originalUrl, { headers: { 'User-Agent': deps.userAgent }, signal: AbortSignal.timeout(deps.timeoutMs) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const declared = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
      const declaredLength = Number(res.headers.get('content-length'))
      if (declaredLength > MAX_BYTES) throw new PermanentImageError(`Image is larger than ${MAX_BYTES / 1024 / 1024} MB`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new PermanentImageError(`Image size ${bytes.byteLength} bytes is outside the allowed range`)
      const type = sniffImageType(bytes)
      if (!type || (declared && declared !== 'application/octet-stream' && declared !== 'binary/octet-stream' && declared !== type)) {
        throw new PermanentImageError(`Not a supported image type (${declared || type || 'unknown'})`)
      }
      const ext = TYPES[type]
      const path = imagePath(campaignId, originalUrl, index, ext, startPosition === 0 && index === 0)
      await deps.upload(path, bytes, type)
      const size = imageSize(bytes)
      imported.push({ originalUrl, storagePath: path, publicUrl: deps.publicUrl(path), width: size?.width ?? null, height: size?.height ?? null, position: position++ })
      deps.existing.add(originalUrl)
    } catch (e) {
      errors.push(`${originalUrl}: ${e instanceof Error ? e.message : String(e)}`)
      if (e instanceof PermanentImageError) unusable.push(originalUrl)
    }
  }
  return { imported, skipped, errors, unusable }
}
