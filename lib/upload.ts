'use client'

import { createClient } from '@/lib/supabase/client'

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

export class UploadError extends Error {}

// Magic-byte sniffing: the file must really be the image type it claims.
async function sniff(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  const brand = String.fromCharCode(...b.slice(4, 12))
  if (brand.startsWith('ftypavif') || brand.startsWith('ftypavis')) return 'image/avif'
  return null
}

export type PreparedImage = { blob: Blob; width: number; height: number; previewUrl: string }

// Validates and re-encodes an image in the browser:
// - checks declared MIME type, real file signature and size
// - decodes it (so it's a real image), checks minimum dimensions
// - resizes to maxSize and re-encodes as WebP, which also strips EXIF/GPS
export async function prepareImage(
  file: File,
  { maxBytes = 15 * 1024 * 1024, minWidth = 600, minHeight = 400, maxSize = 2400, quality = 0.86 } = {},
): Promise<PreparedImage> {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    throw new UploadError('Please upload a JPG, PNG, WebP or AVIF image.')
  }
  if (file.size > maxBytes) throw new UploadError(`That file is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`)
  const real = await sniff(file)
  if (!real || real !== file.type) throw new UploadError("That file isn't a valid image.")

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new UploadError("That image couldn't be read. Try exporting it again as JPG or PNG.")
  }
  if (bitmap.width < minWidth || bitmap.height < minHeight) {
    bitmap.close()
    throw new UploadError(`Images must be at least ${minWidth}×${minHeight} pixels. This one is ${bitmap.width}×${bitmap.height}.`)
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new UploadError('Your browser could not process this image.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  if (!blob || blob.type !== 'image/webp') throw new UploadError('Your browser could not convert this image. Please try another browser.')
  return { blob, width, height, previewUrl: URL.createObjectURL(blob) }
}

// Uploads to Supabase Storage with progress (XHR). Storage policies check
// the path, so users can only write where they are allowed to.
export async function uploadWithProgress(
  bucket: string,
  path: string,
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new UploadError('Your session has expired. Please log in again.')
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${base}/storage/v1/object/${bucket}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    xhr.setRequestHeader('Content-Type', blob.type)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else if (xhr.status === 403 || xhr.status === 401) reject(new UploadError("You don't have permission to upload here."))
      else if (xhr.status === 413) reject(new UploadError('That file is too large.'))
      else reject(new UploadError('Upload failed. Please try again.'))
    }
    xhr.onerror = () => reject(new UploadError('Upload failed. Check your connection and try again.'))
    xhr.send(blob)
  })
  onProgress?.(1)
  return `${base}/storage/v1/object/public/${bucket}/${path}`
}

export async function removeObject(bucket: string, path: string) {
  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw new UploadError('Could not delete the file. Please try again.')
}
