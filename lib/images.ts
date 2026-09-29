const base = () => (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')

export type Bucket = 'avatars' | 'product-images' | 'brand-images' | 'collection-images' | 'article-images'

// Public URL for an object in a public bucket. Absolute URLs pass through.
export function storageUrl(bucket: Bucket, path: string | null | undefined) {
  if (!path) return null
  if (/^https:\/\//.test(path)) return path
  return `${base()}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
}

export const productImageUrl = (path: string | null | undefined) => storageUrl('product-images', path)

// Stable colour for monograms and placeholders.
export function hueFor(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360
  return h
}

export function initials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
