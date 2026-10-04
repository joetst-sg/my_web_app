import { TranslationError } from '@/lib/translation/types'

// Verified facts about a campaign — the only material the AI may use.
export type ProductFacts = {
  sourceName: string
  language: 'ja' | 'en'
  title: string
  shortDescription: string | null
  // Cleaned source text: introduction and features, no plans/rewards/prices.
  description: string | null
  brand: string | null
}

export type CategoryOption = { slug: string; name: string }

export type SummaryOptions = {
  minWords: number
  maxWords: number
  requireTechProduct: boolean
  categories: CategoryOption[]
  // Set when retrying after a word-count miss.
  feedback?: string
}

export type EnglishContent = {
  // Only meaningful when requireTechProduct is set.
  isTechProduct: boolean
  eligibilityReason: string
  title: string
  shortDescription: string
  description: string
  seoTitle: string
  seoDescription: string
  category: string | null
  tags: string[]
  imageAlt: string
}

export type ChineseContent = {
  title: string
  shortDescription: string
  description: string
  seoTitle: string
  seoDescription: string
  imageAlt: string
}

export type SeoContent = { seoTitle: string; seoDescription: string }

// A text model used for product copy. To use another provider, implement
// this and select it with AI_PROVIDER.
export interface AIProvider {
  readonly name: string
  readonly model: string
  generateProductSummary(facts: ProductFacts, options: SummaryOptions): Promise<EnglishContent>
  translateToTraditionalChinese(en: EnglishContent, feedback?: string): Promise<ChineseContent>
  generateSEO(en: Pick<EnglishContent, 'title' | 'description'>): Promise<SeoContent>
  generateTags(en: Pick<EnglishContent, 'title' | 'description'>): Promise<string[]>
}

export { TranslationError as AIError }
