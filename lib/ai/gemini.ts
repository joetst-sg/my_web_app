import { clip, cleanTags, LIMITS, pickCategory, SEO_SYSTEM, summarySystemPrompt, summaryUserPrompt, TAGS_SYSTEM, TRANSLATION_SYSTEM, translationUserPrompt } from './prompts'
import { AIError, type AIProvider, type ChineseContent, type EnglishContent, type ProductFacts, type SeoContent, type SummaryOptions } from './types'

// Google Gemini through the documented REST endpoint
// POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
// with structured JSON output (responseMimeType + responseSchema).

type Schema = { type: string; properties?: Record<string, Schema>; items?: Schema; required?: string[] }
const S = (props: Record<string, 'STRING' | 'BOOLEAN' | 'STRING[]'>): Schema => ({
  type: 'OBJECT',
  properties: Object.fromEntries(Object.entries(props).map(([k, t]) => [k, t === 'STRING[]' ? { type: 'ARRAY', items: { type: 'STRING' } } : { type: t }])),
  required: Object.keys(props),
})

const SUMMARY_SCHEMA = S({ is_tech_product: 'BOOLEAN', eligibility_reason: 'STRING', title: 'STRING', short_description: 'STRING', description: 'STRING', seo_title: 'STRING', seo_description: 'STRING', category: 'STRING', tags: 'STRING[]', image_alt: 'STRING' })
const ZH_SCHEMA = S({ title: 'STRING', short_description: 'STRING', description: 'STRING', seo_title: 'STRING', seo_description: 'STRING', image_alt: 'STRING' })
const SEO_SCHEMA = S({ seo_title: 'STRING', seo_description: 'STRING' })
const TAGS_SCHEMA = S({ tags: 'STRING[]' })

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs = 120_000,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly endpoint = 'https://generativelanguage.googleapis.com/v1beta',
  ) {}

  private async generate(system: string, user: string, schema: Schema): Promise<Record<string, unknown>> {
    let res: Response
    try {
      res = await this.fetchImpl(`${this.endpoint}/models/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        // The key goes in a header, never in the URL.
        headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.3, maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (e) {
      throw new AIError(`Gemini request failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string; status?: string } } | null
      const status = body?.error?.status ?? ''
      // Quotas/rate limits clear by themselves; a bad key or model name doesn't.
      const quota = res.status === 429 || status === 'RESOURCE_EXHAUSTED'
      // "High demand" (503 UNAVAILABLE) is common on the free tier and passes by itself.
      const busy = res.status === 503 || status === 'UNAVAILABLE'
      const retryable = quota || busy || res.status >= 500
      throw new AIError(`Gemini ${res.status}${status ? ` (${status})` : ''}: ${body?.error?.message ?? 'request failed'}`.slice(0, 500), retryable, quota, busy)
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } }
    if (data.promptFeedback?.blockReason) throw new AIError(`Gemini blocked the request (${data.promptFeedback.blockReason}).`, false)
    const candidate = data.candidates?.[0]
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) throw new AIError(`Gemini returned no content (finish reason: ${candidate?.finishReason ?? 'unknown'}).`, candidate?.finishReason !== 'SAFETY')
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new AIError('Gemini returned invalid JSON.')
    }
  }

  async generateProductSummary(facts: ProductFacts, options: SummaryOptions): Promise<EnglishContent> {
    const r = await this.generate(summarySystemPrompt(options), summaryUserPrompt(facts), SUMMARY_SCHEMA)
    const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string).trim() : '')
    if (!str('title') || !str('description')) throw new AIError('Gemini summary is missing a title or description.')
    return {
      isTechProduct: options.requireTechProduct ? r.is_tech_product === true : true,
      eligibilityReason: clip(str('eligibility_reason'), 300),
      title: clip(str('title'), LIMITS.title),
      shortDescription: clip(str('short_description') || str('title'), LIMITS.shortDescription),
      description: clip(str('description'), LIMITS.description),
      seoTitle: clip(str('seo_title') || str('title'), LIMITS.seoTitle),
      seoDescription: clip(str('seo_description') || str('short_description'), LIMITS.seoDescription),
      category: pickCategory(r.category, options.categories),
      tags: cleanTags(r.tags),
      imageAlt: clip(str('image_alt') || str('title'), LIMITS.imageAlt),
    }
  }

  async translateToTraditionalChinese(en: EnglishContent, feedback?: string): Promise<ChineseContent> {
    const r = await this.generate(TRANSLATION_SYSTEM, translationUserPrompt(en, feedback), ZH_SCHEMA)
    const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string).trim() : '')
    if (!str('title') || !str('description')) throw new AIError('Gemini translation is missing a title or description.')
    return {
      title: clip(str('title'), LIMITS.title),
      shortDescription: clip(str('short_description') || str('title'), LIMITS.shortDescription),
      description: clip(str('description'), LIMITS.description),
      seoTitle: clip(str('seo_title') || str('title'), LIMITS.seoTitle),
      seoDescription: clip(str('seo_description') || str('short_description'), LIMITS.seoDescription),
      imageAlt: clip(str('image_alt') || str('title'), LIMITS.imageAlt),
    }
  }

  async generateSEO(en: Pick<EnglishContent, 'title' | 'description'>): Promise<SeoContent> {
    const r = await this.generate(SEO_SYSTEM, `Title: ${en.title}\n\n${en.description}`, SEO_SCHEMA)
    return { seoTitle: clip(String(r.seo_title ?? en.title), LIMITS.seoTitle), seoDescription: clip(String(r.seo_description ?? ''), LIMITS.seoDescription) }
  }

  async generateTags(en: Pick<EnglishContent, 'title' | 'description'>): Promise<string[]> {
    const r = await this.generate(TAGS_SYSTEM, `Title: ${en.title}\n\n${en.description}`, TAGS_SCHEMA)
    return cleanTags(r.tags)
  }
}
