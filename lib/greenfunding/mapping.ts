// Category and tag mapping (source label → our taxonomy).

export type CategoryMapping = { source_category: string; category_id: string | null; priority: number }

// The best mapped category for a campaign, or null when none of its
// categories is mapped (the product then needs category review).
export function resolveCategory(sourceCategories: string[], mappings: CategoryMapping[]): string | null {
  const candidates = mappings
    .filter((m) => m.category_id && sourceCategories.includes(m.source_category))
    .sort((a, b) => a.priority - b.priority)
  return candidates[0]?.category_id ?? null
}

// Normalised form used to find an existing tag: NFKC (full-width → half-width),
// lower case, single spaces. Different words are never merged automatically.
export function normalizeTag(label: string) {
  return label.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function tagSlug(label: string) {
  return normalizeTag(label)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
