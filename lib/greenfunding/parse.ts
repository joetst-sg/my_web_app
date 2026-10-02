// Parsers for GREEN FUNDING's public pages (used by the HTML source only).
// They read the structured parts of the page — Open Graph tags, schema.org
// JSON-LD and the campaign dashboard — and never guess missing values.

import { campaignIdFromUrl, campaignUrlFromHref } from './url'
import type { CampaignRef, SourceCampaign, SourceStatus } from './types'

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', reg: '®', trade: '™', copy: '©', hellip: '…', mdash: '—', ndash: '–', yen: '¥' }

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

const clean = (s: string | null | undefined) => {
  if (!s) return null
  const t = decodeEntities(s).replace(/[　\s]+/g, ' ').trim()
  return t || null
}

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/[　\s]+/g, ' ').trim()

// Attributes of one HTML tag (single, double or unquoted values).
function attributes(tag: string) {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

function meta(html: string, property: string) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0])
    if ((a.property ?? a.name) === property) return clean(a.content)
  }
  return null
}

// Section of the page starting at an element with the given class.
function section(html: string, className: string, length = 4000) {
  const i = html.search(new RegExp(`class=["'][^"']*\\b${className}\\b`))
  return i < 0 ? '' : html.slice(i, i + length)
}

const toNumber = (s: string | null | undefined) => {
  if (!s) return null
  const n = Number(s.replace(/[^\d.]/g, ''))
  return s.match(/\d/) && Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Listing pages (/portals/search?condition=new)
// ---------------------------------------------------------------------------

export function parseCampaignList(html: string, baseUrl: string): CampaignRef[] {
  const seen = new Set<string>()
  const out: CampaignRef[] = []
  const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '')
  for (const m of html.matchAll(/href=["']([^"'#]*\/projects\/\d+[^"'#]*)["']/gi)) {
    const url = campaignUrlFromHref(decodeEntities(m[1]), baseUrl)
    const campaignId = url && campaignIdFromUrl(url)
    if (!url || !campaignId || seen.has(campaignId)) continue
    // Only campaigns on GREEN FUNDING itself.
    if (new URL(url).hostname.replace(/^www\./, '') !== baseHost) continue
    seen.add(campaignId)
    out.push({ campaignId, url })
  }
  return out
}

// ---------------------------------------------------------------------------
// Description: HTML → plain text with light markdown, plus its media
// ---------------------------------------------------------------------------

export function htmlToText(html: string): { text: string | null; images: string[]; videos: string[] } {
  const images: string[] = []
  const videos: string[] = []
  let s = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  for (const m of s.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)) {
    const yt = m[1].match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,20})/)
    if (yt) videos.push(`https://www.youtube.com/watch?v=${yt[1]}`)
    const vimeo = m[1].match(/player\.vimeo\.com\/video\/(\d+)/)
    if (vimeo) videos.push(`https://vimeo.com/${vimeo[1]}`)
  }
  for (const m of s.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) images.push(decodeEntities(m[1]))
  s = s
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, t: string) => `\n\n### ${stripTags(t)}\n\n`)
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t: string) => {
      const inner = stripTags(t)
      return inner ? `**${inner}**` : ''
    })
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t: string) => `\n• ${stripTags(t)}`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|ul|ol|h\d|blockquote|table|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
  const text = decodeEntities(s)
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t　]+/g, ' ').trim())
    .join('\n')
    .replace(/\*\*\s*\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text: text || null, images: [...new Set(images)], videos: [...new Set(videos)] }
}

// ---------------------------------------------------------------------------
// Campaign page (/<partner>/projects/<id>)
// ---------------------------------------------------------------------------

type JsonLdProduct = { '@type'?: string; name?: string; image?: string | string[]; offers?: { price?: string | number; priceCurrency?: string }[] | { price?: string | number; priceCurrency?: string } }

function jsonLdProduct(html: string): JsonLdProduct | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      // Some pages put raw line breaks inside strings; JSON doesn't allow them.
      const data = JSON.parse(m[1].replace(/[\r\n]+/g, ' '))
      for (const item of Array.isArray(data) ? data : [data]) if (item?.['@type'] === 'Product') return item
    } catch {
      // ignore malformed blocks
    }
  }
  return null
}

function statusFrom(dashboard: string, daysRemaining: number | null, hoursRemaining: number | null): SourceStatus {
  const text = stripTags(dashboard)
  if (/中止|キャンセル/.test(text)) return 'cancelled'
  if (/開始前|近日公開|公開予定|COMING\s*SOON/i.test(text)) return 'upcoming'
  if (/終了しました|募集終了|プロジェクト終了|FINISHED/i.test(text)) return 'ended'
  if (daysRemaining !== null || hoursRemaining !== null) return /SUCCESS/i.test(text) ? 'succeeded' : 'active'
  return 'unknown'
}

export function parseCampaignPage(html: string, ref: CampaignRef, baseUrl: string, now = new Date()): SourceCampaign {
  const product = jsonLdProduct(html)
  const header = section(html, 'project_header', 6000)
  const dashboard = section(html, 'project_sidebar_dashboard', 3000)

  const title = meta(html, 'og:title') ?? clean(product?.name ?? null) ?? clean(header.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' '))
  const shortDescription = meta(html, 'og:description') ?? meta(html, 'description')

  // Body: from the end of the share buttons to the sidebar.
  const start = html.search(/class=["']project-content["']/)
  let body = ''
  if (start >= 0) {
    const end = html.indexOf('l-sidebar', start)
    body = html.slice(start, end > start ? end : undefined)
    const afterShare = body.search(/<\/ul>/)
    const visual = body.match(/class=["']project-main_visual["'][\s\S]*?<\/div>/)?.[0] ?? ''
    body = (afterShare >= 0 ? body.slice(afterShare + 5) : body) + visual
  }
  const { text: description, images: bodyImages, videos } = htmlToText(body)

  const categories = [...header.matchAll(/<a[^>]+category_id=\d+[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => stripTags(m[1]).replace(/^#\s*/, '')).filter(Boolean)
  const ownerName = clean(stripTags(section(html, 'project_sidebar_profile-name', 600).replace(/^[^>]*>/, '').split(/<svg|<\/div>/)[0] ?? ''))

  const goalAmount = toNumber(stripTags(section(html, 'project_sidebar_dashboard-target-info', 400)).match(/目標\s*[¥￥]?\s*([\d,]+)/)?.[1])
  const raisedAmount = toNumber(stripTags(section(html, 'project_sidebar_dashboard-amount', 300)).match(/[¥￥]?\s*([\d,]+)/)?.[1])
  const info = stripTags(section(html, 'project_sidebar_dashboard-info', 1500))
  const backerCount = toNumber(info.match(/支援人数\s*([\d,]+)\s*人/)?.[1])
  const days = info.match(/残り時間\s*([\d,]+)\s*日/)
  const hours = info.match(/残り時間\s*([\d,]+)\s*時間/)
  const daysRemaining = days ? toNumber(days[1]) : hours ? 0 : null
  const hoursRemaining = hours ? toNumber(hours[1]) : null

  const offers = product?.offers ? (Array.isArray(product.offers) ? product.offers : [product.offers]) : []
  const prices = offers.map((o) => toNumber(String(o.price ?? ''))).filter((n): n is number => n !== null && n > 0)
  const currency = offers.find((o) => o.priceCurrency)?.priceCurrency?.toUpperCase() ?? (goalAmount !== null && /[¥￥]/.test(dashboard) ? 'JPY' : null)

  const hero = meta(html, 'og:image') ?? (Array.isArray(product?.image) ? product?.image[0] : product?.image) ?? null
  const imageUrls = [...new Set([hero, ...bodyImages].filter((u): u is string => Boolean(u)).map((u) => new URL(u, baseUrl).toString()))]

  // The page shows only time remaining; an end date derived from it is marked as estimated.
  let endsAt: string | null = null
  if (daysRemaining !== null || hoursRemaining !== null) {
    const ms = hoursRemaining !== null ? hoursRemaining * 3_600_000 : (daysRemaining ?? 0) * 86_400_000
    endsAt = new Date(now.getTime() + ms).toISOString()
  }

  return {
    ...ref,
    title,
    shortDescription,
    description,
    ownerName,
    categories: [...new Set(categories)],
    tags: [],
    status: statusFrom(dashboard, daysRemaining, hoursRemaining),
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    price: prices.length ? Math.min(...prices) : null,
    goalAmount,
    raisedAmount,
    backerCount,
    daysRemaining,
    startsAt: null,
    endsAt,
    endsAtEstimated: endsAt !== null,
    imageUrls,
    raw: {
      videos,
      planPrices: prices,
      hoursRemaining,
      ogImage: hero,
      partner: new URL(ref.url).pathname.split('/')[1] ?? null,
    },
  }
}
