'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/auth'
import type { ActionResult } from '@/lib/errors'
import { greenFundingConfig } from '@/lib/greenfunding/config'
import { backfillSummaries, runSync, logSync, type SyncResult } from '@/lib/greenfunding/sync'
import { sourceContentHash, translationSource } from '@/lib/greenfunding/content'
import { campaignIdFromUrl, validateCampaignUrl } from '@/lib/greenfunding/url'
import { publishImport } from '@/lib/greenfunding/publish'
import { createServiceClient } from '@/lib/supabase/server'
import { processTranslationQueue, translateProductNow, type QueueResult } from '@/lib/translation/queue'

// Every action here is for administrators only. The checks run on the server;
// privileged writes then use the service role.
async function admin() {
  const viewer = await getViewer()
  if (!viewer?.isAdmin) return { ok: false as const, error: 'Only administrators can do this.' }
  const db = createServiceClient()
  if (!db) return { ok: false as const, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' }
  return { ok: true as const, db, viewer }
}

const uuid = z.string().uuid()

function refresh(slug?: string | null) {
  revalidatePath('/admin/greenfunding', 'layout')
  revalidatePath('/', 'layout')
  if (slug) revalidatePath(`/products/${slug}`)
}

async function audit(db: NonNullable<ReturnType<typeof createServiceClient>>, actorId: string, action: string, productId: string, metadata: Record<string, unknown> = {}) {
  await db.from('audit_logs').insert({ actor_id: actorId, action, entity_type: 'product', entity_id: productId, metadata: metadata as never })
}

export async function syncNow(): Promise<ActionResult<SyncResult>> {
  const a = await admin()
  if (!a.ok) return a
  const result = await runSync('manual')
  refresh()
  if (!result.ran) return { ok: false, error: result.reason ?? 'Sync did not run.' }
  return { ok: true, data: result, message: `Sync completed — new: ${result.newProducts}, updated: ${result.updatedProducts}, skipped: ${result.skipped}, errors: ${result.errors}` }
}

export async function translateNow(): Promise<ActionResult<QueueResult>> {
  const a = await admin()
  if (!a.ok) return a
  await backfillSummaries(a.db)
  const result = await processTranslationQueue(1)
  refresh()
  if (result.note) return { ok: false, error: result.note }
  return { ok: true, data: result, message: result.processed ? `Translated: ${result.succeeded}, retrying: ${result.retried}, failed: ${result.failed}` : 'No translations waiting.' }
}

async function loadImport(db: NonNullable<ReturnType<typeof createServiceClient>>, productId: string) {
  const [{ data: meta }, { data: product }, { data: cats }] = await Promise.all([
    db.from('product_source_metadata').select('*').eq('product_id', productId).maybeSingle(),
    db.from('products').select('id, slug, name, status, external_url, brand_id, translations').eq('id', productId).maybeSingle(),
    db.from('product_categories').select('category_id').eq('product_id', productId),
  ])
  return { meta, product, hasCategory: Boolean(cats?.length) }
}

export async function approveAndPublish(productId: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const res = await publishImport(a.db, productId, { kind: 'admin', id: a.viewer.id, email: a.viewer.email })
  if (!res.ok) return res
  refresh(res.slug)
  return { ok: true, message: 'Published in English and Traditional Chinese.' }
}

async function setState(productId: string, status: 'rejected' | 'archived', pipeline: 'rejected' | 'archived', operation: 'reject' | 'archive', note?: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const { db, viewer } = a
  const { meta, product } = await loadImport(db, productId)
  if (!meta || !product) return { ok: false, error: 'This is not an imported GREEN FUNDING product.' }
  const { error } = await db.from('products').update({ status, published_at: null }).eq('id', productId)
  if (error) return { ok: false, error: error.message }
  await db.from('product_source_metadata').update({ pipeline_status: pipeline, reviewed_by: viewer.id, reviewed_at: new Date().toISOString() }).eq('id', meta.id)
  await logSync(db, { operation, status: 'success', campaignId: meta.source_campaign_id, campaignUrl: meta.source_url, productId, message: `${operation === 'reject' ? 'Rejected' : 'Archived'} by ${viewer.email}${note ? `: ${note}` : ''}` })
  await audit(db, viewer.id, `greenfunding.${operation}`, productId, note ? { note } : {})
  refresh(product.slug)
  return { ok: true, message: operation === 'reject' ? 'Rejected. It will not be imported again.' : 'Archived and hidden from the site.' }
}

export async function rejectImport(productId: string, note?: string) {
  return setState(productId, 'rejected', 'rejected', 'reject', z.string().max(500).optional().parse(note))
}

export async function archiveImport(productId: string) {
  return setState(productId, 'archived', 'archived', 'archive')
}

// Moves a rejected/archived import back to review.
export async function reopenImport(productId: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const { db } = a
  const { meta } = await loadImport(db, productId)
  if (!meta) return { ok: false, error: 'Unknown import.' }
  await db.from('products').update({ status: 'pending_review', published_at: null }).eq('id', productId)
  await db.from('product_source_metadata').update({ pipeline_status: 'pending_review' }).eq('id', meta.id)
  refresh()
  return { ok: true, message: 'Moved back to review.' }
}

const textSchema = z.object({
  title: z.string().trim().min(2, 'Title must be 2–120 characters.').max(120, 'Title must be 2–120 characters.'),
  short_description: z.string().trim().max(200).optional().transform((v) => v || null),
  description: z.string().trim().max(20000).optional().transform((v) => v || null),
  seo_title: z.string().trim().max(70).optional().transform((v) => v || null),
  seo_description: z.string().trim().max(170).optional().transform((v) => v || null),
})

export async function saveTranslations(productId: string, input: { en: z.input<typeof textSchema>; zh: z.input<typeof textSchema> }): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const en = textSchema.safeParse(input.en)
  const zh = textSchema.safeParse(input.zh)
  if (!en.success) return { ok: false, error: `English: ${en.error.issues[0]?.message}` }
  if (!zh.success) return { ok: false, error: `Traditional Chinese: ${zh.error.issues[0]?.message}` }
  const { db, viewer } = a
  const { meta, product } = await loadImport(db, productId)
  if (!meta || !product) return { ok: false, error: 'This is not an imported GREEN FUNDING product.' }

  const translations = { ...((product.translations as Record<string, unknown>) ?? {}) }
  translations['zh-HK'] = { name: zh.data.title, tagline: zh.data.short_description, description: zh.data.description, seo_title: zh.data.seo_title, seo_description: zh.data.seo_description }
  const { error } = await db
    .from('products')
    .update({ name: en.data.title, tagline: en.data.short_description, description: en.data.description, seo_title: en.data.seo_title, seo_description: en.data.seo_description, translations: translations as never })
    .eq('id', productId)
  if (error) return { ok: false, error: error.message }

  for (const [language, v] of [['en', en.data], ['zh-HK', zh.data]] as const) {
    const { data: last } = await db.from('product_translation_versions').select('version').eq('product_id', productId).eq('language', language).order('version', { ascending: false }).limit(1).maybeSingle()
    await db.from('product_translation_versions').insert({
      product_id: productId,
      language,
      version: (last?.version ?? 0) + 1,
      title: v.title,
      short_description: v.short_description,
      description: v.description,
      seo_title: v.seo_title,
      seo_description: v.seo_description,
      source_content_hash: meta.source_content_hash,
      origin: 'admin',
      created_by: viewer.id,
    })
  }
  // Saving after a source update counts as reviewing it.
  await db.from('product_source_metadata').update({ translated_content_hash: meta.source_content_hash, update_available: false, changed_fields: [] }).eq('id', meta.id)
  await logSync(db, { operation: 'edit', status: 'success', campaignId: meta.source_campaign_id, campaignUrl: meta.source_url, productId, message: `Translations edited by ${viewer.email}` })
  refresh(product.slug)
  return { ok: true, message: 'Translations saved (new version recorded).' }
}

// Copies the newest AI versions onto the product (e.g. after a source update).
export async function applyLatestAiTranslation(productId: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const { db } = a
  const { data: versions } = await db.from('product_translation_versions').select('*').eq('product_id', productId).eq('origin', 'ai').order('version', { ascending: false })
  const latest = (lang: string) => versions?.find((v) => v.language === lang)
  const en = latest('en')
  const zh = latest('zh-HK')
  if (!en || !zh) return { ok: false, error: 'No AI translation available yet.' }
  return saveTranslations(productId, {
    en: { title: en.title ?? '', short_description: en.short_description ?? '', description: en.description ?? '', seo_title: en.seo_title ?? '', seo_description: en.seo_description ?? '' },
    zh: { title: zh.title ?? '', short_description: zh.short_description ?? '', description: zh.description ?? '', seo_title: zh.seo_title ?? '', seo_description: zh.seo_description ?? '' },
  })
}

export async function dismissUpdate(productId: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  await a.db.from('product_source_metadata').update({ update_available: false, changed_fields: [] }).eq('product_id', productId)
  refresh()
  return { ok: true, message: 'Update dismissed.' }
}

export async function retranslate(productId: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const { db } = a
  const { meta } = await loadImport(db, productId)
  if (!meta?.source_content_hash) return { ok: false, error: 'Unknown import.' }
  // Same source text → reuse the job row (resets a failed job).
  await db.from('translation_jobs').upsert(
    { product_id: productId, source_content_hash: meta.source_content_hash, status: 'queued', attempts: 0, last_error: null, run_after: new Date().toISOString() },
    { onConflict: 'product_id,source_content_hash' },
  )
  refresh()
  return { ok: true, message: 'Translation queued. It runs within 5 minutes, or click “Translate now”.' }
}

export async function setImportCategory(productId: string, categoryId: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success || !uuid.safeParse(categoryId).success) return { ok: false, error: 'Unknown product or category.' }
  const { db } = a
  await db.from('product_categories').delete().eq('product_id', productId)
  const { error } = await db.from('product_categories').insert({ product_id: productId, category_id: categoryId, is_primary: true })
  if (error) return { ok: false, error: error.message }
  await db.from('product_source_metadata').update({ needs_category_review: false }).eq('product_id', productId)
  refresh()
  return { ok: true, message: 'Category saved.' }
}

// Changing the campaign URL is allowed only to another valid URL for the same
// GREEN FUNDING campaign (e.g. when GREEN FUNDING moves it to another path).
export async function updateCampaignUrl(productId: string, url: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const config = greenFundingConfig()
  const check = validateCampaignUrl(url.trim(), config.allowedDomains)
  if (!check.ok) return { ok: false, error: check.reason }
  const { db, viewer } = a
  const { meta, product } = await loadImport(db, productId)
  if (!meta || !product) return { ok: false, error: 'This is not an imported GREEN FUNDING product.' }
  if (campaignIdFromUrl(url.trim()) !== meta.source_campaign_id) return { ok: false, error: `The URL must point to the same campaign (project ${meta.source_campaign_id}).` }
  const clean = url.trim()
  const { error } = await db.from('product_source_metadata').update({ source_url: clean }).eq('id', meta.id)
  if (error) return { ok: false, error: error.message }
  await db.from('products').update({ external_url: clean }).eq('id', productId)
  await logSync(db, { operation: 'edit', status: 'success', campaignId: meta.source_campaign_id, campaignUrl: clean, productId, message: `Campaign URL changed by ${viewer.email} (was ${meta.source_url})` })
  await audit(db, viewer.id, 'greenfunding.campaign_url', productId, { from: meta.source_url, to: clean })
  refresh(product.slug)
  return { ok: true, message: 'Campaign URL updated.' }
}

export async function saveCategoryMapping(sourceCategory: string, categoryId: string | null): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  const label = z.string().trim().min(1).max(80).safeParse(sourceCategory)
  if (!label.success || (categoryId !== null && !uuid.safeParse(categoryId).success)) return { ok: false, error: 'Invalid mapping.' }
  const { error } = await a.db.from('category_mappings').upsert({ source: 'greenfunding', source_category: label.data, category_id: categoryId }, { onConflict: 'source,source_category' })
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true, message: 'Mapping saved. It applies to future imports.' }
}

// Saves an administrator-edited Japanese summary (what gets translated) and
// translates it straight away into English and Traditional Chinese.
export async function saveSummaryAndTranslate(productId: string, summary: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const text = z.string().trim().min(10, 'Write at least a sentence.').max(3000, 'Keep the summary under 3,000 characters.').safeParse(summary)
  if (!text.success) return { ok: false, error: text.error.issues[0]?.message ?? 'Invalid summary.' }
  const { db, viewer } = a
  const { meta, product } = await loadImport(db, productId)
  if (!meta || !product) return { ok: false, error: 'This is not an imported GREEN FUNDING product.' }
  const config = greenFundingConfig()
  const hash = sourceContentHash(translationSource({ title: meta.ja_title, shortDescription: meta.ja_short_description, description: meta.ja_description }, config.summaryChars, text.data))
  await db.from('product_source_metadata').update({ ja_summary: text.data, ja_summary_edited: true, source_content_hash: hash }).eq('id', meta.id)
  await logSync(db, { operation: 'edit', status: 'success', campaignId: meta.source_campaign_id, campaignUrl: meta.source_url, productId, message: `Japanese summary edited by ${viewer.email}` })
  const res = await translateProductNow(productId)
  refresh(product.slug)
  if (!res.ok) return { ok: false, error: `Summary saved, but translation failed: ${res.error}` }
  return { ok: true, message: 'Summary saved and translated into English and Traditional Chinese.' }
}

// Re-builds the automatic Japanese summary from the campaign page (undoing edits).
export async function resetSummary(productId: string): Promise<ActionResult> {
  const a = await admin()
  if (!a.ok) return a
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const { meta } = await loadImport(a.db, productId)
  if (!meta) return { ok: false, error: 'Unknown import.' }
  const source = translationSource({ title: meta.ja_title, shortDescription: meta.ja_short_description, description: meta.ja_description }, greenFundingConfig().summaryChars)
  await a.db.from('product_source_metadata').update({ ja_summary: source.summary ?? '', ja_summary_edited: false, source_content_hash: sourceContentHash(source) }).eq('id', meta.id)
  refresh()
  return { ok: true, message: 'Automatic summary restored. Click “Save & translate” to translate it.' }
}
