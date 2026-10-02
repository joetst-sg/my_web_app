import { createHash } from 'node:crypto'
import { buildJapaneseSummary, cleanShortDescription } from './summary'
import type { SourceCampaign } from './types'

// What is sent for translation: the title, the short description and a short
// Japanese summary (never the full page, support plans or prices).
export type TranslationSource = { title: string | null; shortDescription: string | null; summary: string | null }

export function translationSource(c: { title: string | null; shortDescription: string | null; description: string | null }, summaryChars: number, editedSummary?: string | null): TranslationSource {
  return {
    title: c.title,
    shortDescription: cleanShortDescription(c.shortDescription),
    summary: editedSummary ?? buildJapaneseSummary(c.description, summaryChars),
  }
}

// Hash of exactly what is translated. If it hasn't changed, nothing is sent
// to the translation service again.
export function sourceContentHash(s: TranslationSource) {
  return createHash('sha256').update(JSON.stringify(['v2', s.title ?? '', s.shortDescription ?? '', s.summary ?? ''])).digest('hex')
}

// Fields that differ between the stored source data and a fresh fetch.
export type StoredSource = {
  ja_title: string | null
  ja_short_description: string | null
  ja_description: string | null
  source_status: string
  campaign_ends_at: string | null
  source_categories: string[]
  image_urls: string[]
}

export function changedFields(stored: StoredSource, fresh: SourceCampaign): string[] {
  const changed: string[] = []
  if ((stored.ja_title ?? null) !== fresh.title) changed.push('title')
  if ((stored.ja_short_description ?? null) !== fresh.shortDescription) changed.push('short_description')
  if ((stored.ja_description ?? null) !== fresh.description) changed.push('description')
  if (stored.source_status !== fresh.status) changed.push('status')
  // Estimated end dates move a little on every fetch; only count real changes (> 1 day).
  const a = stored.campaign_ends_at ? Date.parse(stored.campaign_ends_at) : null
  const b = fresh.endsAt ? Date.parse(fresh.endsAt) : null
  if ((a === null) !== (b === null) || (a !== null && b !== null && Math.abs(a - b) > 36 * 3_600_000)) changed.push('end_date')
  if ([...stored.source_categories].sort().join('|') !== [...fresh.categories].sort().join('|')) changed.push('categories')
  const storedImages = new Set(stored.image_urls)
  if (fresh.imageUrls.some((u) => !storedImages.has(u))) changed.push('images')
  return changed
}

// Translations must be reviewed again when the text they came from changed.
export const TEXT_FIELDS = ['title', 'short_description', 'description'] as const
export const needsTranslationReview = (changed: string[]) => changed.some((f) => (TEXT_FIELDS as readonly string[]).includes(f))

// Eligibility for a first import.
export function eligibility(c: SourceCampaign, excludedCategories: string[]): { eligible: true } | { eligible: false; reason: string } {
  if (!c.title) return { eligible: false, reason: 'No title found on the campaign page.' }
  if (c.status === 'cancelled') return { eligible: false, reason: 'Campaign is cancelled.' }
  if (c.status === 'ended') return { eligible: false, reason: 'Campaign has already ended.' }
  const excluded = c.categories.find((cat) => excludedCategories.includes(cat))
  if (excluded) return { eligible: false, reason: `Category "${excluded}" is excluded (GREEN_FUNDING_EXCLUDED_CATEGORIES).` }
  return { eligible: true }
}
