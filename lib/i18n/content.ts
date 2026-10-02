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
