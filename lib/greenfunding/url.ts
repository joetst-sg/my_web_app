// Campaign URL rules. Buy Now always uses the URL exactly as imported; these
// checks only decide whether a URL is acceptable at all.

const CAMPAIGN_PATH = /^\/([a-z0-9_-]{1,60})\/projects\/(\d{1,10})\/?$/i

export function hostAllowed(host: string, allowedDomains: string[]) {
  const h = host.toLowerCase()
  return allowedDomains.some((d) => h === d)
}

// A valid, https, credential-free URL on an authorized GREEN FUNDING domain.
export function validateCampaignUrl(raw: string | null | undefined, allowedDomains: string[]): { ok: true; url: URL } | { ok: false; reason: string } {
  if (!raw || !raw.trim()) return { ok: false, reason: 'Campaign URL is empty.' }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'Campaign URL is not a valid URL.' }
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'Campaign URL must use HTTPS.' }
  if (url.username || url.password) return { ok: false, reason: 'Campaign URL must not contain credentials.' }
  if (url.port) return { ok: false, reason: 'Campaign URL must not use a custom port.' }
  if (!hostAllowed(url.hostname, allowedDomains)) return { ok: false, reason: `Campaign URL must be on ${allowedDomains.join(' or ')}.` }
  if (!CAMPAIGN_PATH.test(url.pathname)) return { ok: false, reason: 'Campaign URL must be a GREEN FUNDING project page (/…/projects/<id>).' }
  return { ok: true, url }
}

// The numeric project id is GREEN FUNDING's stable campaign identifier.
export function campaignIdFromUrl(raw: string): string | null {
  try {
    return new URL(raw).pathname.match(CAMPAIGN_PATH)?.[2] ?? null
  } catch {
    return null
  }
}

// Absolute campaign URL from a link found on a GREEN FUNDING page
// (e.g. "/lab/projects/9474"). Activity/comment sub-pages are not campaigns.
export function campaignUrlFromHref(href: string, baseUrl: string): string | null {
  let url: URL
  try {
    url = new URL(href, baseUrl)
  } catch {
    return null
  }
  if (!CAMPAIGN_PATH.test(url.pathname)) return null
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`
}
