import type { Locale } from './config'

type Translatable = { translations?: unknown } | null | undefined

// Picks a translated database field ("name", "title", …) for the locale,
// falling back to the English column value.
export function localized<T extends Translatable>(row: T, field: string, locale: Locale, fallback?: string | null): string {
  const english = fallback ?? ((row as Record<string, unknown> | null)?.[field] as string | null | undefined) ?? ''
  if (!row || locale === 'en') return english
  const tr = (row as { translations?: Record<string, Record<string, string>> }).translations?.[locale]?.[field]
  return tr && tr.trim() ? tr : english
}

// Same, for a translations object stored separately (e.g. category_translations on a product card).
export function fromTranslations(translations: unknown, field: string, locale: Locale, english: string | null | undefined): string {
  if (locale === 'en') return english ?? ''
  const tr = (translations as Record<string, Record<string, string>> | null)?.[locale]?.[field]
  return tr && tr.trim() ? tr : english ?? ''
}

const PRODUCT_FIELDS = ['name', 'tagline', 'description', 'seo_title', 'seo_description'] as const
type ProductText = Partial<Record<(typeof PRODUCT_FIELDS)[number], string | null>>

// A product row with its translatable text swapped for the locale's version
// (from products.translations), field by field, falling back to English.
export function localizeProduct<T extends ProductText & { translations?: unknown }>(p: T, locale: Locale): T {
  if (locale === 'en') return p
  const out = { ...p }
  for (const f of PRODUCT_FIELDS) if (f in p) (out as ProductText)[f] = fromTranslations(p.translations, f, locale, p[f]) || null
  return out
}

// Same for product card rows, whose translations column is product_translations.
export function localizeCard<T extends { name: string | null; tagline: string | null; product_translations?: unknown }>(c: T, locale: Locale): T {
  if (locale === 'en') return c
  return {
    ...c,
    name: fromTranslations(c.product_translations, 'name', locale, c.name) || null,
    tagline: fromTranslations(c.product_translations, 'tagline', locale, c.tagline) || null,
  }
}
