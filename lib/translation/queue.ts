import 'server-only'
import { slugify } from '@/lib/format'
import { logSync } from '@/lib/greenfunding/sync'
import { applyTranslationAutomatically, nextAttempt, pipelineAfterTranslation } from '@/lib/greenfunding/decide'
import { createServiceClient } from '@/lib/supabase/server'
import { greenFundingConfig } from '@/lib/greenfunding/config'
import { translationSource } from '@/lib/greenfunding/content'
import { createTranslator, translationConfig } from './index'
import { TranslationError, type TargetLanguage, type TranslationOutput, type TranslationProvider } from './types'

type Db = NonNullable<ReturnType<typeof createServiceClient>>

export type QueueResult = { processed: number; succeeded: number; failed: number; retried: number; waiting?: number; note?: string }

const LANGS: TargetLanguage[] = ['en', 'zh-HK']

async function nextVersion(db: Db, productId: string, language: TargetLanguage) {
  const { data } = await db.from('product_translation_versions').select('version').eq('product_id', productId).eq('language', language).order('version', { ascending: false }).limit(1).maybeSingle()
  return (data?.version ?? 0) + 1
}

async function uniqueSlug(db: Db, base: string, productId: string) {
  for (const candidate of [base, `${base}-2`, `${base}-${productId.slice(0, 6)}`]) {
    const { data } = await db.from('products').select('id').eq('slug', candidate).neq('id', productId).maybeSingle()
    if (!data) return candidate
  }
  return `${base}-${productId.slice(0, 8)}`
}

// Writes the generated text onto the product (en → columns, zh-HK → translations)
// and the image alt texts.
async function applyToProduct(db: Db, productId: string, campaignId: string, slug: string, out: Record<TargetLanguage, TranslationOutput>) {
  const { data: product } = await db.from('products').select('translations').eq('id', productId).single()
  const translations = { ...((product?.translations as Record<string, unknown>) ?? {}) }
  translations['zh-HK'] = {
    name: out['zh-HK'].title,
    tagline: out['zh-HK'].shortDescription,
    description: out['zh-HK'].description,
    seo_title: out['zh-HK'].seoTitle,
    seo_description: out['zh-HK'].seoDescription,
  }
  // Slugs come from the English name once it exists (gf-<id> is a placeholder).
  const newSlug = slug === `gf-${campaignId}` ? await uniqueSlug(db, `${slugify(out.en.title).slice(0, 70) || 'product'}-${campaignId}`, productId) : slug
  await db
    .from('products')
    .update({
      name: out.en.title,
      tagline: out.en.shortDescription,
      description: out.en.description,
      seo_title: out.en.seoTitle,
      seo_description: out.en.seoDescription,
      translations: translations as never,
      slug: newSlug,
    })
    .eq('id', productId)

  const { data: images } = await db.from('product_images').select('id, position').eq('product_id', productId).order('position')
  for (const [i, img] of (images ?? []).entries()) {
    const n = i === 0 ? '' : ` (${i + 1})`
    await db
      .from('product_images')
      .update({ alt: `${out.en.imageAlt}${n}`.slice(0, 200), translations: { 'zh-HK': { alt: `${out['zh-HK'].imageAlt}${i === 0 ? '' : `（${i + 1}）`}`.slice(0, 200) } } })
      .eq('id', img.id)
  }
}

// forceApply: an administrator asked for this translation (e.g. after editing
// the Japanese summary), so it replaces the current text.
export async function processTranslationJob(
  db: Db,
  translator: TranslationProvider,
  job: { id: string; product_id: string; source_content_hash: string; attempts: number; max_attempts: number },
  options: { forceApply?: boolean } = {},
) {
  const started = Date.now()
  const { data: meta } = await db
    .from('product_source_metadata')
    .select('id, source_campaign_id, source_url, ja_title, ja_short_description, ja_description, ja_summary, owner_name, source_content_hash, pipeline_status')
    .eq('product_id', job.product_id)
    .maybeSingle()
  const { data: product } = await db.from('products').select('status, slug').eq('id', job.product_id).maybeSingle()
  const log = { operation: 'translation', campaignId: meta?.source_campaign_id, campaignUrl: meta?.source_url, productId: job.product_id }

  // The source changed again after this job was queued: a newer job covers it.
  if (!meta || !product || !meta.ja_title || meta.source_content_hash !== job.source_content_hash) {
    await db.from('translation_jobs').update({ status: 'failed', last_error: 'Superseded by newer source content.', finished_at: new Date().toISOString() }).eq('id', job.id)
    return 'superseded' as const
  }

  await db.from('product_source_metadata').update({ pipeline_status: meta.pipeline_status === 'pending_review' ? 'pending_review' : meta.pipeline_status === 'published' ? 'published' : 'translating' }).eq('id', meta.id)
  try {
    // Only the title, the cleaned short description and the Japanese summary
    // are translated — not the full campaign page, plans or prices.
    const source = translationSource({ title: meta.ja_title, shortDescription: meta.ja_short_description, description: meta.ja_description }, greenFundingConfig().summaryChars, meta.ja_summary)
    const input = { title: meta.ja_title, shortDescription: source.shortDescription, description: source.summary || null, brand: meta.owner_name }
    const en = await translator.translate(input, 'en')
    const zh = await translator.translate({ ...input, englishTitle: en.title }, 'zh-HK')
    const out = { en, 'zh-HK': zh } as Record<TargetLanguage, TranslationOutput>

    for (const language of LANGS) {
      const o = out[language]
      await db.from('product_translation_versions').insert({
        product_id: job.product_id,
        language,
        version: await nextVersion(db, job.product_id, language),
        title: o.title,
        short_description: o.shortDescription,
        description: o.description,
        seo_title: o.seoTitle,
        seo_description: o.seoDescription,
        image_alts: [o.imageAlt],
        source_content_hash: job.source_content_hash,
        origin: 'ai',
        translation_provider: translator.name,
        translation_model: translator.model,
      })
    }

    const { count: adminEdits } = await db.from('product_translation_versions').select('id', { count: 'exact', head: true }).eq('product_id', job.product_id).eq('origin', 'admin')
    const applied = options.forceApply || applyTranslationAutomatically(product.status, (adminEdits ?? 0) > 0)
    if (applied) await applyToProduct(db, job.product_id, meta.source_campaign_id, product.slug, out)
    if (applied && product.status === 'draft') await db.from('products').update({ status: 'pending_review' }).eq('id', job.product_id)

    await db
      .from('product_source_metadata')
      .update({
        pipeline_status: pipelineAfterTranslation(meta.pipeline_status === 'translating' ? 'translating' : meta.pipeline_status),
        ...(applied ? { translated_content_hash: job.source_content_hash } : { update_available: true }),
        last_error: null,
      })
      .eq('id', meta.id)
    await db.from('translation_jobs').update({ status: 'succeeded', attempts: job.attempts + 1, finished_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
    await logSync(db, { ...log, status: 'success', message: applied ? `English and Traditional Chinese generated (${translator.model})` : `New AI translation saved as a version for review (not applied: ${product.status === 'published' ? 'product is published' : 'admin-edited text'})`, durationMs: Date.now() - started })
    return 'succeeded' as const
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    // A usage limit isn't a failure: wait an hour and try again, without using up attempts.
    if (e instanceof TranslationError && e.quota) {
      await db.from('translation_jobs').update({ status: 'queued', last_error: `Waiting for translation quota: ${message}`.slice(0, 2000), run_after: new Date(Date.now() + 60 * 60_000).toISOString() }).eq('id', job.id)
      await logSync(db, { ...log, status: 'warning', message: 'Translation quota reached; will try again in about an hour', error: message, durationMs: Date.now() - started })
      return 'quota' as const
    }
    const attempts = job.attempts + 1
    const retryable = !(e instanceof TranslationError) || e.retryable
    const next = nextAttempt(attempts, job.max_attempts, retryable)
    await db.from('translation_jobs').update({ status: next.status, attempts, last_error: message.slice(0, 2000), run_after: next.runAfter ?? new Date().toISOString(), finished_at: next.status === 'failed' ? new Date().toISOString() : null }).eq('id', job.id)
    if (next.status === 'failed') await db.from('product_source_metadata').update({ pipeline_status: meta.pipeline_status === 'published' ? 'published' : 'sync_error', last_error: `Translation failed: ${message}`.slice(0, 2000) }).eq('id', meta.id)
    await logSync(db, { ...log, status: next.status === 'failed' ? 'error' : 'warning', message: next.status === 'failed' ? `Translation failed after ${attempts} attempt(s)` : `Translation attempt ${attempts} failed; retrying`, error: message, durationMs: Date.now() - started })
    return next.status === 'failed' ? ('failed' as const) : ('retry' as const)
  }
}

// Translates one product right away (admin action), applying the result.
export async function translateProductNow(productId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createServiceClient()
  if (!db) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }
  const translator = createTranslator()
  if (!translator) return { ok: false, error: 'TRANSLATION_API_KEY is not set.' }
  const { data: meta } = await db.from('product_source_metadata').select('source_content_hash').eq('product_id', productId).maybeSingle()
  if (!meta?.source_content_hash) return { ok: false, error: 'Unknown import.' }
  const { data: job } = await db
    .from('translation_jobs')
    .upsert(
      { product_id: productId, source_content_hash: meta.source_content_hash, status: 'running', attempts: 0, last_error: null, started_at: new Date().toISOString(), run_after: new Date().toISOString() },
      { onConflict: 'product_id,source_content_hash' },
    )
    .select('id, product_id, source_content_hash, attempts, max_attempts')
    .single()
  if (!job) return { ok: false, error: 'Could not queue the translation.' }
  const outcome = await processTranslationJob(db, translator, job, { forceApply: true })
  if (outcome === 'succeeded') return { ok: true }
  const { data: after } = await db.from('translation_jobs').select('last_error').eq('id', job.id).single()
  return { ok: false, error: after?.last_error ?? `Translation ${outcome}.` }
}

// Processes a few queued jobs (each makes two translation requests).
export async function processTranslationQueue(limit = translationConfig().jobsPerRun, translatorOverride?: TranslationProvider): Promise<QueueResult> {
  const result: QueueResult = { processed: 0, succeeded: 0, failed: 0, retried: 0 }
  const db = createServiceClient()
  if (!db) return { ...result, note: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }
  const translator = translatorOverride ?? createTranslator()
  if (!translator) return { ...result, note: 'TRANSLATION_API_KEY is not set; translations are waiting in the queue.' }

  // Jobs stuck in "running" (e.g. a timed-out function) go back to the queue.
  await db.from('translation_jobs').update({ status: 'queued' }).eq('status', 'running').lt('started_at', new Date(Date.now() - 15 * 60_000).toISOString())

  const { data: jobs } = await db
    .from('translation_jobs')
    .select('id, product_id, source_content_hash, attempts, max_attempts')
    .eq('status', 'queued')
    .lte('run_after', new Date().toISOString())
    .order('created_at')
    .limit(limit)
  for (const job of jobs ?? []) {
    const { data: claimed } = await db.from('translation_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'queued').select('id')
    if (!claimed?.length) continue
    result.processed++
    const outcome = await processTranslationJob(db, translator, job)
    if (outcome === 'succeeded') result.succeeded++
    else if (outcome === 'retry') result.retried++
    else if (outcome === 'quota') {
      // The limit applies to every job: stop for now.
      result.waiting = (result.waiting ?? 0) + 1
      break
    } else result.failed++
  }
  return result
}
