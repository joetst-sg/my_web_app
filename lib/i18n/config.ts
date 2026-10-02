// Locale configuration shared by the proxy, server and client code.
// To add a language: add it to `locales`, give it a URL prefix, names and
// a dictionary in lib/i18n/dictionaries/, and register it in dictionaries.ts.

export const locales = ['en', 'zh-HK'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

// URL prefix per locale. English keeps the existing, unprefixed URLs.
export const localePrefix: Record<Locale, string> = { en: '', 'zh-HK': '/zh' }

// Shown in the language switcher (always in their own language).
export const localeLabel: Record<Locale, { short: string; long: string }> = {
  en: { short: 'EN', long: 'English' },
  'zh-HK': { short: '中文', long: '繁體中文' },
}

// Used for Intl formatting, <html lang>, hreflang and Open Graph.
export const htmlLang: Record<Locale, string> = { en: 'en', 'zh-HK': 'zh-HK' }
export const ogLocale: Record<Locale, string> = { en: 'en_US', 'zh-HK': 'zh_HK' }
export const intlLocale: Record<Locale, string> = { en: 'en-US', 'zh-HK': 'zh-HK' }

export const LOCALE_COOKIE = 'NEXT_LOCALE'
// Set by the proxy on every request; never trusted from the client.
export const LOCALE_HEADER = 'x-loupe-locale'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}

// Paths that exist only once (English/internal): never prefixed.
const UNLOCALIZED = /^\/(admin|api|go|auth|_next|feed\.xml|sitemap\.xml|robots\.txt|opengraph-image|favicon\.ico)(\/|$|\?|#)/

export function isLocalizablePath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !UNLOCALIZED.test(path)
}

// Splits "/zh/products?x=1" into { locale: 'zh-HK', path: '/products?x=1' }.
export function splitLocale(path: string): { locale: Locale; path: string } {
  for (const locale of locales) {
    const prefix = localePrefix[locale]
    if (!prefix) continue
    if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`)) {
      const rest = path.slice(prefix.length)
      return { locale, path: rest === '' || rest.startsWith('?') || rest.startsWith('#') ? `/${rest}` : rest }
    }
  }
  return { locale: defaultLocale, path }
}

// Adds the locale prefix to an internal path. Idempotent, and leaves
// external URLs, admin/API routes and anchors untouched.
export function localizePath(href: string, locale: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href
  const { path } = splitLocale(href)
  if (!isLocalizablePath(path)) return path
  const prefix = localePrefix[locale]
  if (!prefix) return path
  return path === '/' ? prefix : path.startsWith('/?') || path.startsWith('/#') ? `${prefix}${path.slice(1)}` : `${prefix}${path}`
}

// Picks a supported locale from an Accept-Language header. Only Traditional
// Chinese variants map to zh-HK; Simplified Chinese stays English.
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null
  const prefs = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=')
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 }
    })
    .filter((p) => p.tag && !Number.isNaN(p.q))
    .sort((a, b) => b.q - a.q)
  for (const { tag } of prefs) {
    if (/^zh-(hk|tw|mo|hant)/.test(tag)) return 'zh-HK'
    if (tag === 'zh' || /^zh-(cn|sg|hans)/.test(tag)) return null
    if (tag.startsWith('en')) return 'en'
  }
  return null
}
