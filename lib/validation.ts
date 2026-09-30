import { z } from 'zod'

// Escapes % and _ for use in ilike patterns.
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|\[?::1\]?$)/i

// Only plain https URLs to public hosts. No credentials, no IPs of private
// networks, no javascript:/data: schemes.
export function isSafeHttpsUrl(value: string) {
  try {
    const u = new URL(value)
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) &&
      !PRIVATE_HOST.test(u.hostname) &&
      value.length <= 2000
    )
  } catch {
    return false
  }
}

export const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(isSafeHttpsUrl, 'Please enter a valid HTTPS URL (it must start with https://).')

export const optionalHttpsUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || isSafeHttpsUrl(v), 'Please enter a valid HTTPS URL (it must start with https://).')

export function videoProvider(url: string): 'youtube' | 'vimeo' | 'other' {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') return 'youtube'
    if (host === 'vimeo.com' || host === 'player.vimeo.com') return 'vimeo'
  } catch {
    // fall through
  }
  return 'other'
}

// Privacy-friendly embed URL for YouTube/Vimeo links, or null.
export function videoEmbedUrl(url: string) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v') ?? u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
    }
  } catch {
    // invalid URL
  }
  return null
}

// Only allow redirects to local paths (prevents open redirects).
export function safeNext(next: string | null | undefined, fallback = '/') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback
  return next
}
