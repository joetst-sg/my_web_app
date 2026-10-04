import 'server-only'
import { slugify } from '@/lib/format'
import { applyTranslationAutomatically, nextAttempt, pipelineAfterTranslation } from '@/lib/greenfunding/decide'
import { autoPublishIfEnabled } from '@/lib/greenfunding/publish'
import { sourceDefinition } from '@/lib/greenfunding/sources'
import { buildJapaneseSummary, cleanShortDescription } from '@/lib/greenfunding/summary'
import { importCampaignImages, logSync, placeholderSlug, removeProductImageFiles } from '@/lib/greenfunding/sync'
import { createServiceClient } from '@/lib/supabase/server'
import { countWords, hasSimplified, wordRange } from './prompts'
import { AIError, type AIProvider, type ChineseContent, type EnglishContent, type ProductFacts } from './types'

type Db = NonNullable<ReturnType<typeof createServiceClient>>
type Job = { id: string; product_id: string; source_content_hash: string; attempts: number; max_attempts: number }

// Cleaned source text for the AI: for Japanese pages, the introduction and
// features with plans, rewards, prices, shipping, FAQs and filler removed
// (a longer version of the summary used for machine translation).
export function factsFromRegistry(meta: { source: string; source_name: string | null; source_language: string; ja_title: string | null; ja_short_description: string | null; ja_description: string | null; owner_name: string | null }): ProductFacts {
  const ja = meta.source_language === 'ja'
  return {
    sourceName: meta.source_name ?? meta.source,
    language: ja ? 'ja' : 'en',
    title: meta.ja_title ?? '',
    shortDescription: ja ? cleanShortDescription(meta.ja_short_description) : meta.ja_short_description,
    description: ja ? buildJapaneseSummary(meta.ja_description, 4000) : meta.ja_description,
    brand: meta.owner_name,
  }
}

// English summary within the word range (asks again with feedback if not).
export async function englishWithinRange(ai: AIProvider, facts: ProductFacts, options: Omit<Parameters<AIProvider['generateProductSummary']>[1], 'minWords' | 'maxWords' | 'feedback'>, retries = 2) {
  const { min, max } = wordRange(facts)
  let feedback: string | undefined
  for (let attempt = 0; attempt <= retries; attempt++) {
    const en = await ai.generateProductSummary(facts, { ...options, minWords: min, maxWords: max, feedback })
    if (options.requireTechProduct && !en.isTechProduct) return { en, words: countWords(en.description), min, max }
    const words = countWords(en.description)
    if (words >= min && words <= max) return { en, words, min, max }
    feedback = `Your previous description had ${words} words. Rewrite it so it has between ${min} and ${max} words, using only the source facts.`
  }
  throw new AIError(`The English summary was not within ${min}–${max} words after ${retries + 1} attempts.`)
}

// Traditional Chinese translation of the English content (never Simplified).
export async function chineseFromEnglish(ai: AIProvider, en: EnglishContent, retries = 1): Promise<ChineseContent> {
  let feedback: string | undefined
  for (let attempt = 0; attempt <= retries; attempt++) {
    const zh = await ai.translateToTraditionalChinese(en, feedback)
    if (!hasSimplified(Object.values(zh).join(''))) return zh
    feedback = 'Your previous answer contained Simplified Chinese characters. Use Traditional Chinese characters only.'
  }
  throw new AIError('The Chinese translation contained Simplified Chinese characters.')
}

async function setTags(db: Db, productId: string, tags: string[]) {
  const ids: string[] = []
  for (const name of tags) {
    const slug = slugify(name)
    if (!slug) continue
    const { data: found } = await db.from('tags').select('id').eq('slug', slug).maybeSingle()
    const id = found?.id ?? (await db.from('tags').insert({ slug, name }).select('id').single()).data?.id
    if (id) ids.push(id)
  }
  if (!ids.length) return
  await db.from('product_tags').delete().eq('product_id', productId)
  await db.from('product_tags').insert([...new Set(ids)].map((tag_id) => ({ product_id: productId, tag_id })))
}

async function uniqueSlug(db: Db, base: string, productId: string) {
  for (const candidate of [base, `${base}-2`, `${base}-${productId.slice(0, 6)}`]) {
    const { data } = await db.from('products').select('id').eq('slug', candidate).neq('id', productId).maybeSingle()
    if (!data) return candidate
  }
  return `${base}-${productId.slice(0, 8)}`
}

// Runs one content job with the AI. Outcomes match processTranslationJob.
export async function processAiJob(db: Db, ai: AIProvider, job: Job, options: { forceApply?: boolean } = {}) {
  const started = Date.now()
  const { data: meta } = await db
    .from('product_source_metadata')
    .select('id, source, source_name, source_language, source_campaign_id, source_url, ja_title, ja_short_description, ja_description, owner_name, source_content_hash, pipeline_status, raw_metadata')
    .eq('product_id', job.product_id)
    .maybeSingle()
  const { data: product } = await db.from('products').select('status, slug, translations').eq('id', job.product_id).maybeSingle()
  const log = { source: meta?.source, operation: 'translation', campaignId: meta?.source_campaign_id, campaignUrl: meta?.source_url, productId: job.product_id }

  if (!meta || !product || !meta.ja_title || meta.source_content_hash !== job.source_content_hash) {
    await db.from('translation_jobs').update({ status: 'failed', last_error: 'Superseded by newer source content.', finished_at: new Date().toISOString() }).eq('id', job.id)
    return 'superseded' as const
  }
  const def = sourceDefinition(meta.source)
  await db.from('product_source_metadata').update({ pipeline_status: meta.pipeline_status === 'published' ? 'published' : 'translating' }).eq('id', meta.id)

  try {
    // 1–2. English summary (with eligibility check) within the word range.
    const facts = factsFromRegistry(meta)
    const { data: cats } = await db.from('categories').select('slug, name').order('sort_order')
    const { en, words } = await englishWithinRange(ai, facts, { requireTechProduct: def?.requireTechProduct ?? false, categories: cats ?? [] })

    // Not a Tech & Innovation product: never published, never re-imported.
    if (def?.requireTechProduct && !en.isTechProduct) {
      await removeProductImageFiles(db, job.product_id)
      await db.from('products').delete().eq('id', job.product_id)
      await db.from('product_source_metadata').update({ product_id: null, pipeline_status: 'not_eligible', last_error: `Not a Tech & Innovation product: ${en.eligibilityReason}` }).eq('id', meta.id)
      await db.from('translation_jobs').delete().eq('id', job.id)
      await logSync(db, { ...log, operation: 'not_eligible', status: 'warning', message: `Skipped — not a Tech & Innovation product (${en.eligibilityReason})`, durationMs: Date.now() - started })
      return 'not_eligible' as const
    }

    // 3. Traditional Chinese, translated from the English summary.
    const zh = await chineseFromEnglish(ai, en)

    // Versions for the audit trail.
    for (const [language, c] of [['en', en], ['zh-HK', zh]] as const) {
      const { data: last } = await db.from('product_translation_versions').select('version').eq('product_id', job.product_id).eq('language', language).order('version', { ascending: false }).limit(1).maybeSingle()
      await db.from('product_translation_versions').insert({
        product_id: job.product_id,
        language,
        version: (last?.version ?? 0) + 1,
        title: c.title,
        short_description: c.shortDescription,
        description: c.description,
        seo_title: c.seoTitle,
        seo_description: c.seoDescription,
        image_alts: [c.imageAlt],
        source_content_hash: job.source_content_hash,
        origin: 'ai',
        translation_provider: ai.name,
        translation_model: ai.model,
      })
    }

    const { count: adminEdits } = await db.from('product_translation_versions').select('id', { count: 'exact', head: true }).eq('product_id', job.product_id).eq('origin', 'admin')
    const applied = options.forceApply || applyTranslationAutomatically(product.status, (adminEdits ?? 0) > 0)
    if (applied) {
      const translations = { ...((product.translations as Record<string, unknown>) ?? {}), 'zh-HK': { name: zh.title, tagline: zh.shortDescription, description: zh.description, seo_title: zh.seoTitle, seo_description: zh.seoDescription } }
      const slug = product.slug === placeholderSlug(meta.source, meta.source_campaign_id)
        ? await uniqueSlug(db, `${slugify(en.title).slice(0, 70) || 'product'}-${slugify(meta.source_campaign_id).slice(0, 20)}`.replace(/-+$/, ''), job.product_id)
        : product.slug
      await db.from('products').update({ name: en.title, tagline: en.shortDescription, description: en.description, seo_title: en.seoTitle, seo_description: en.seoDescription, translations: translations as never, slug }).eq('id', job.product_id)
      if (en.tags.length) await setTags(db, job.product_id, en.tags)

      // Category: keep an existing one, otherwise the AI's choice from the controlled list.
      const { count: hasCategory } = await db.from('product_categories').select('product_id', { count: 'exact', head: true }).eq('product_id', job.product_id)
      if (!hasCategory && en.category) {
        const { data: cat } = await db.from('categories').select('id').eq('slug', en.category).maybeSingle()
        if (cat) {
          await db.from('product_categories').insert({ product_id: job.product_id, category_id: cat.id, is_primary: true })
          await db.from('product_source_metadata').update({ needs_category_review: false }).eq('id', meta.id)
        }
      }

      // 4. Images: sources that defer them copy them now; any product still
      // without an image gets another try from the stored source URLs.
      const { count: before } = await db.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', job.product_id)
      if (def && (def.deferImages || !before)) {
        const urls = ((meta.raw_metadata as { imageUrls?: string[] } | null)?.imageUrls ?? []).filter((u) => typeof u === 'string')
        const res = await importCampaignImages(db, def.config, job.product_id, { campaignId: slugify(meta.source_campaign_id).slice(0, 80) || meta.source_campaign_id, imageUrls: urls })
        if (res.errors.length) await logSync(db, { ...log, operation: 'image_import', status: res.imported ? 'warning' : 'error', message: `${res.imported} image(s) imported`, error: res.errors.join('\n') })
      }
      const { count: images } = await db.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', job.product_id)
      if (!images) throw new AIError('No usable image could be imported for this product.')

      const { data: imgs } = await db.from('product_images').select('id, position').eq('product_id', job.product_id).order('position')
      for (const [i, img] of (imgs ?? []).entries()) {
        await db.from('product_images').update({ alt: `${en.imageAlt}${i ? ` (${i + 1})` : ''}`.slice(0, 200), translations: { 'zh-HK': { alt: `${zh.imageAlt}${i ? `（${i + 1}）` : ''}`.slice(0, 200) } } }).eq('id', img.id)
      }
    }

    await db.from('product_source_metadata').update({
      pipeline_status: pipelineAfterTranslation(meta.pipeline_status === 'translating' ? 'translating' : meta.pipeline_status),
      summary_word_count: words,
      ...(applied ? { translated_content_hash: job.source_content_hash } : { update_available: true }),
      last_error: null,
    }).eq('id', meta.id)
    await db.from('translation_jobs').update({ status: 'succeeded', attempts: job.attempts + 1, finished_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
    await logSync(db, { ...log, status: 'success', message: applied ? `English summary (${words} words) and Traditional Chinese written by ${ai.name} (${ai.model})` : 'New AI version saved for review (current text kept)', durationMs: Date.now() - started })

    // 5. Duplicate check and validation, then automatic publishing.
    if (applied && product.status !== 'published' && !['rejected', 'archived'].includes(meta.pipeline_status)) await autoPublishIfEnabled(db, job.product_id)
    return 'succeeded' as const
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (e instanceof AIError && e.quota) {
      await db.from('translation_jobs').update({ status: 'queued', last_error: `Waiting for AI quota: ${message}`.slice(0, 2000), run_after: new Date(Date.now() + 60 * 60_000).toISOString() }).eq('id', job.id)
      await logSync(db, { ...log, status: 'warning', message: 'AI quota reached; will try again in about an hour', error: message, durationMs: Date.now() - started })
      return 'quota' as const
    }
    if (e instanceof AIError && e.busy) {
      await db.from('translation_jobs').update({ status: 'queued', last_error: `AI busy: ${message}`.slice(0, 2000), run_after: new Date(Date.now() + 15 * 60_000).toISOString() }).eq('id', job.id)
      await logSync(db, { ...log, status: 'warning', message: 'AI temporarily busy; will try again in about 15 minutes', error: message, durationMs: Date.now() - started })
      return 'quota' as const
    }
    const attempts = job.attempts + 1
    const retryable = !(e instanceof AIError) || e.retryable
    const next = nextAttempt(attempts, job.max_attempts, retryable)
    await db.from('translation_jobs').update({ status: next.status, attempts, last_error: message.slice(0, 2000), run_after: next.runAfter ?? new Date().toISOString(), finished_at: next.status === 'failed' ? new Date().toISOString() : null }).eq('id', job.id)
    if (next.status === 'failed') await db.from('product_source_metadata').update({ pipeline_status: meta.pipeline_status === 'published' ? 'published' : 'failed', last_error: `Content step failed: ${message}`.slice(0, 2000) }).eq('id', meta.id)
    await logSync(db, { ...log, status: next.status === 'failed' ? 'error' : 'warning', message: next.status === 'failed' ? `Failed after ${attempts} attempt(s) — not published` : `Attempt ${attempts} failed; retrying`, error: message, durationMs: Date.now() - started })
    return next.status === 'failed' ? ('failed' as const) : ('retry' as const)
  }
}
