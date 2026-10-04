import type { CategoryOption, EnglishContent, ProductFacts, SummaryOptions } from './types'

export const LIMITS = { title: 120, shortDescription: 200, seoTitle: 70, seoDescription: 170, imageAlt: 120, description: 20000 }

export function summarySystemPrompt(o: SummaryOptions) {
  return `You are an expert product editor for joetangtst.com, a product discovery website.

Based only on the verified source information provided, write a clear and engaging product summary of ${o.minWords}–${o.maxWords} words.

Explain what the product is, its main purpose, important features, technology/design, intended users, and practical benefits.

Rules:
- Do not invent information. Do not make unsupported claims. If the source doesn't say something, leave it out.
- Never invent prices, certifications, battery life, dimensions, materials, awards, reviews, guarantees, delivery dates or performance figures.
- Do not mention prices, pledge levels, rewards, discounts, early-bird offers, shipping or delivery schedules.
- Do not copy the source text word-for-word; rewrite it in your own words. If the source is Japanese, write in English.
- Avoid hype and superlatives such as "the world's best", "revolutionary" or "guaranteed" unless the source states them as a verifiable fact (then attribute them, e.g. "the maker says").
- Keep brand names, product names, model numbers, technical standards and units exactly as in the source.
- Write natural English for an international technology audience. Plain paragraphs; you may use one short "### Key features" heading followed by lines starting with "• ".
- description must be ${o.minWords}–${o.maxWords} words.${o.feedback ? `\n- ${o.feedback}` : ''}

Other fields:
- title: the product name (brand + product), at most ${80} characters. Use the original product name where appropriate; no slogans.
- short_description: one sentence, at most ${180} characters.
- seo_title: at most 60 characters. seo_description: at most 155 characters. Factual; no ratings, reviews, prices or awards.
- category: exactly one slug from this list, or "none" if nothing fits: ${o.categories.map((c) => `${c.slug} (${c.name})`).join(', ')}.
- tags: 3 to 8 short, relevant English tags (e.g. "Wireless", "Portable", "AI"). No duplicates.
- image_alt: a short neutral description of the product for image alt text.
- is_tech_product: ${o.requireTechProduct ? 'true only if this is a physical Tech & Innovation product (consumer electronics, gadgets, smart devices, tools, hardware); false for films, music, games without hardware, books, art, fashion without technology, food, causes, events or services' : 'always true'}.
- eligibility_reason: one short sentence explaining is_tech_product.`
}

export function summaryUserPrompt(f: ProductFacts) {
  return [
    `Source: ${f.sourceName} (original language: ${f.language === 'ja' ? 'Japanese' : 'English'})`,
    f.brand ? `Creator / brand: ${f.brand}` : null,
    `Title: ${f.title}`,
    f.shortDescription ? `Short description: ${f.shortDescription}` : null,
    f.description && f.description !== f.shortDescription ? `Description:\n${f.description.slice(0, LIMITS.description)}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const TRANSLATION_SYSTEM = `Translate the English product content into Traditional Chinese (繁體中文) for readers in Taiwan and Hong Kong.

Rules:
- Use Traditional Chinese characters only. Never output Simplified Chinese.
- Natural, neutral commercial/product wording shared by Taiwan and Hong Kong. Examples: Smart Home → 智慧家庭, Smart Lock → 智慧門鎖, Portable Charger → 便攜式充電器, AI-powered → AI 驅動.
- Keep brand names, product names, model numbers, technical standards and units unchanged (do not translate them).
- Keep the structure: a "### " heading line stays a heading, lines starting with "• " stay bullet points, blank lines between paragraphs.
- Translate only what is in the English text. Do not add or remove information.
- Use full-width Chinese punctuation (，。：；！？「」) in Chinese sentences.
- seo_title at most 60 characters; seo_description at most 155 characters; short_description at most 120 characters.`

export function translationUserPrompt(en: Pick<EnglishContent, 'title' | 'shortDescription' | 'description' | 'seoTitle' | 'seoDescription' | 'imageAlt'>, feedback?: string) {
  return `${feedback ? `${feedback}\n\n` : ''}Title: ${en.title}\n\nShort description: ${en.shortDescription}\n\nSEO title: ${en.seoTitle}\n\nSEO description: ${en.seoDescription}\n\nImage alt text: ${en.imageAlt}\n\nDescription:\n${en.description}`
}

export const SEO_SYSTEM = `Write SEO metadata for a product page, based only on the text provided. seo_title at most 60 characters; seo_description at most 155 characters. Factual: no ratings, reviews, prices, awards or claims not in the text.`
export const TAGS_SYSTEM = `Return 3 to 8 short, relevant English tags for this product, based only on the text provided. No duplicates.`

// Words in an English summary (headings and bullet markers don't count).
export function countWords(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[•\-*]\s*/gm, '')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length
}

// Target length: 200–300 words when the source has enough real detail,
// otherwise a shorter 60–150-word summary (nothing gets padded or invented).
export function wordRange(f: Pick<ProductFacts, 'language' | 'description' | 'shortDescription'>): { min: number; max: number } {
  const text = f.description ?? f.shortDescription ?? ''
  const rich = f.language === 'ja' ? text.length >= 600 : countWords(text) >= 120
  return rich ? { min: 200, max: 300 } : { min: 60, max: 150 }
}

// Characters that exist only in Simplified Chinese (a common subset).
// (Characters also used in Traditional Chinese or in Japanese names, such as 划 体 虫, are left out.)
const SIMPLIFIED = /[们这个发时设图账邮录为与级产电无线动书对机统让计张鱼类网络应该说话请问进还过开关门间现实点击页载软颜质价买卖费]/
export const hasSimplified = (text: string) => SIMPLIFIED.test(text)

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
export const clip = cut

export function cleanTags(tags: unknown): string[] {
  const out: string[] = []
  for (const t of Array.isArray(tags) ? tags : []) {
    const v = String(t).replace(/[#<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  return out.slice(0, 8)
}

export function pickCategory(value: unknown, options: CategoryOption[]) {
  const v = String(value ?? '').trim().toLowerCase()
  return options.some((o) => o.slug === v) ? v : null
}
