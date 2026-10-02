import type { TargetLanguage, TranslationInput } from './types'

export const LIMITS = { title: 120, shortDescription: 200, seoTitle: 70, seoDescription: 170, imageAlt: 120, description: 20000 }

const LANGUAGE: Record<TargetLanguage, string> = {
  en: 'natural, clear English for an international technology and product-discovery audience',
  'zh-HK':
    'Traditional Chinese (繁體中文) that reads naturally in both Hong Kong and Taiwan. Never use Simplified Chinese characters. Prefer neutral terms shared by both regions (e.g. 電郵, 登入, 網站, 影片, 充電, 藍牙). Use full-width Chinese punctuation (，。：；！？「」) in Chinese sentences',
}

export function systemPrompt(target: TargetLanguage) {
  return `You localise crowdfunding product pages from Japanese for a product-discovery website.
Write ${LANGUAGE[target]}.

Rules:
- Translate the meaning for shoppers, not word for word, but do NOT add, remove or strengthen any claim. No invented specifications, awards, prices, dates or guarantees. Keep hedges such as "according to the manufacturer".
- Keep unchanged: brand names, product and model names/numbers, trademarks (®, ™), URLs, units, measurements, numbers, prices, percentages and technical specifications.
- Keep the structure: lines starting with "### " stay headings, "**bold**" stays bold, lines starting with "• " stay bullet points, blank lines separate paragraphs. Do not use any other markdown or HTML.
- Leave out purely Japan-specific logistics that only make sense on the original crowdfunding page (shipping schedules, payment-plan instructions, store opening hours and addresses, "support this project" calls to action, review-video introductions), but keep everything that describes the product itself.
- title: a concise product name (brand + product + key type), at most ${LIMITS.title} characters, no marketing slogans.
- short_description: one or two sentences, at most ${LIMITS.shortDescription} characters.
- seo_title: at most ${LIMITS.seoTitle} characters. seo_description: at most ${LIMITS.seoDescription} characters. Both factual, no clickbait.
- image_alt: a short neutral description of the product for image alt text, at most ${LIMITS.imageAlt} characters.
Return the result only through the save_translation tool.`
}

export function userPrompt(input: TranslationInput) {
  const parts = [
    input.brand ? `Brand / campaign owner: ${input.brand}` : null,
    input.englishTitle ? `English product name already chosen (keep it consistent): ${input.englishTitle}` : null,
    `Japanese title:\n${input.title}`,
    input.shortDescription ? `Japanese short description:\n${input.shortDescription}` : null,
    input.description ? `Japanese full description:\n${input.description.slice(0, LIMITS.description)}` : null,
  ]
  return parts.filter(Boolean).join('\n\n')
}

export const TOOL = {
  name: 'save_translation',
  description: 'Save the localised product content.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      short_description: { type: 'string' },
      description: { type: 'string' },
      seo_title: { type: 'string' },
      seo_description: { type: 'string' },
      image_alt: { type: 'string' },
    },
    required: ['title', 'short_description', 'description', 'seo_title', 'seo_description', 'image_alt'],
  },
} as const

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

// Validates and trims a provider's raw output.
export function normalizeOutput(raw: Record<string, unknown>) {
  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string).trim() : '')
  const title = str('title')
  if (!title) throw new Error('Translation is missing a title.')
  return {
    title: cut(title, LIMITS.title),
    shortDescription: str('short_description') ? cut(str('short_description'), LIMITS.shortDescription) : null,
    description: str('description') ? cut(str('description'), LIMITS.description) : null,
    seoTitle: cut(str('seo_title') || title, LIMITS.seoTitle),
    seoDescription: cut(str('seo_description') || str('short_description') || title, LIMITS.seoDescription),
    imageAlt: cut(str('image_alt') || title, LIMITS.imageAlt),
  }
}
