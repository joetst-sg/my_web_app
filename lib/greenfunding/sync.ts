import 'server-only'
import { randomUUID } from 'node:crypto'
import { slugify } from '@/lib/format'
import { createServiceClient } from '@/lib/supabase/server'
import { greenFundingConfig, type GreenFundingConfig } from './config'
import { changedFields, eligibility, needsTranslationReview, sourceContentHash } from './content'
import { actionForListedCampaign, shouldCheckForUpdates, syncIsDue } from './decide'
import { IMAGE_BUCKET, importImages } from './images'
import { resolveCategory, type CategoryMapping } from './mapping'
import { createCampaignSource } from './sources'
import { RequestBudgetExceeded, SourceError, type CampaignSource, type SourceCampaign } from './types'
import { hostAllowed, validateCampaignUrl } from './url'

type Db = NonNullable<ReturnType<typeof createServiceClient>>
type Registry = {
  id: string
  product_id: string | null
  pipeline_status: string
  source_status: string
  source_campaign_id: string
  source_url: string
  ja_title: string | null
  ja_short_description: string | null
  ja_description: string | null
  campaign_ends_at: string | null
  source_categories: string[]
  changed_fields: string[]
  translated_content_hash: string | null
}

export type SyncResult = {
  ran: boolean
  reason?: string
  runId?: string
  mode?: string
  discovered: number
  newProducts: number
  updatedProducts: number
  skipped: number
  errors: number
  requests: number
}

const SOURCE = 'greenfunding'
const REGISTRY_COLUMNS =
  'id, product_id, pipeline_status, source_status, source_campaign_id, source_url, ja_title, ja_short_description, ja_description, campaign_ends_at, source_categories, changed_fields, translated_content_hash'

export async function logSync(
  db: Db,
  entry: { runId?: string | null; operation: string; status: 'success' | 'warning' | 'error'; campaignId?: string | null; campaignUrl?: string | null; productId?: string | null; message?: string | null; error?: string | null; durationMs?: number | null },
) {
  await db.from('sync_logs').insert({
    run_id: entry.runId ?? null,
    source: SOURCE,
    operation: entry.operation,
    status: entry.status,
    campaign_id: entry.campaignId ?? null,
    campaign_url: entry.campaignUrl ?? null,
    product_id: entry.productId ?? null,
    message: entry.message?.slice(0, 1000) ?? null,
    error_message: entry.error?.slice(0, 2000) ?? null,
    duration_ms: entry.durationMs ?? null,
  })
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e))

async function findOrCreateBrand(db: Db, name: string | null): Promise<string | null> {
  if (!name) return null
  const { data: found } = await db.from('brands').select('id').ilike('name', name.replace(/[%_\\]/g, '\\$&')).limit(1).maybeSingle()
  if (found) return found.id
  const base = slugify(name) || `gf-brand-${randomUUID().slice(0, 8)}`
  for (const slug of [base, `${base}-${randomUUID().slice(0, 4)}`]) {
    const { data, error } = await db.from('brands').insert({ name: name.slice(0, 120), slug, is_published: false }).select('id').single()
    if (data) return data.id
    if (error?.code !== '23505') throw error
  }
  return null
}

async function rememberSourceCategories(db: Db, labels: string[]) {
  if (!labels.length) return
  await db.from('category_mappings').upsert(
    labels.map((source_category) => ({ source: SOURCE, source_category, category_id: null })),
    { onConflict: 'source,source_category', ignoreDuplicates: true },
  )
}

function storageFor(db: Db) {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}`.replace(/\/$/, '')
  return {
    upload: async (path: string, bytes: Uint8Array, contentType: string) => {
      const { error } = await db.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType, upsert: false, cacheControl: '31536000' })
      // Already uploaded by an earlier, interrupted run: reuse it.
      if (error && !/exists|duplicate/i.test(error.message)) throw error
    },
    publicUrl: (path: string) => `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`,
  }
}

async function importCampaignImages(db: Db, config: GreenFundingConfig, productId: string, campaign: SourceCampaign) {
  const allowed = campaign.imageUrls.filter((u) => {
    try {
      const url = new URL(u)
      return url.protocol === 'https:' && hostAllowed(url.hostname, config.imageDomains)
    } catch {
      return false
    }
  })
  const { data: rows } = await db.from('product_images').select('original_url, position').eq('product_id', productId)
  const existing = new Set((rows ?? []).map((r) => r.original_url).filter((u): u is string => Boolean(u)))
  const room = Math.max(config.maxImagesPerProduct - (rows?.length ?? 0), 0)
  const wanted = allowed.filter((u) => !existing.has(u)).slice(0, room)
  if (!wanted.length) return { imported: 0, errors: [] as string[] }
  const storage = storageFor(db)
  const start = Math.max(-1, ...(rows ?? []).map((r) => r.position)) + 1
  const result = await importImages(
    campaign.campaignId,
    wanted,
    { fetch, ...storage, existing, delayMs: config.requestDelayMs, timeoutMs: config.timeoutMs, userAgent: config.userAgent },
    start,
  )
  if (result.imported.length) {
    const { error } = await db.from('product_images').insert(
      result.imported.map((img) => ({
        product_id: productId,
        storage_path: img.publicUrl,
        original_url: img.originalUrl,
        width: img.width,
        height: img.height,
        position: img.position,
      })),
    )
    if (error) result.errors.push(`Saving image rows failed: ${error.message}`)
  }
  return { imported: result.imported.length, errors: result.errors }
}

async function queueTranslation(db: Db, productId: string, hash: string) {
  const maxAttempts = Math.min(Math.max(Number(process.env.TRANSLATION_MAX_RETRIES) || 3, 1), 10)
  await db.from('translation_jobs').upsert(
    { product_id: productId, source_content_hash: hash, status: 'queued', max_attempts: maxAttempts },
    { onConflict: 'product_id,source_content_hash', ignoreDuplicates: true },
  )
}

// Imports one new campaign. Either a complete draft product is created, or
// nothing is (the registry row records the error and the next run retries).
async function importCampaign(db: Db, config: GreenFundingConfig, runId: string, campaign: SourceCampaign, mappings: CategoryMapping[]) {
  const started = Date.now()
  const base = { runId, campaignId: campaign.campaignId, campaignUrl: campaign.url }
  const registryFields = {
    source: SOURCE,
    source_url: campaign.url,
    source_campaign_id: campaign.campaignId,
    source_status: campaign.status,
    import_mode: config.mode,
    ja_title: campaign.title,
    ja_short_description: campaign.shortDescription,
    ja_description: campaign.description,
    owner_name: campaign.ownerName,
    source_categories: campaign.categories,
    source_tags: campaign.tags,
    currency: campaign.currency,
    price: campaign.price,
    goal_amount: campaign.goalAmount,
    raised_amount: campaign.raisedAmount,
    backer_count: campaign.backerCount,
    days_remaining: campaign.daysRemaining,
    campaign_starts_at: campaign.startsAt,
    campaign_ends_at: campaign.endsAt,
    campaign_ends_at_estimated: campaign.endsAtEstimated,
    raw_metadata: campaign.raw as never,
    last_synced_at: new Date().toISOString(),
  }

  const urlCheck = validateCampaignUrl(campaign.url, config.allowedDomains)
  const eligible = eligibility(campaign, config.excludedCategories)
  if (!urlCheck.ok || !eligible.eligible) {
    const reason = !urlCheck.ok ? urlCheck.reason : (eligible as { reason: string }).reason
    await db.from('product_source_metadata').upsert({ ...registryFields, pipeline_status: 'not_eligible', last_error: reason }, { onConflict: 'source,source_campaign_id' })
    await logSync(db, { ...base, operation: 'not_eligible', status: 'warning', message: reason, durationMs: Date.now() - started })
    return 'skipped' as const
  }

  // Claim the campaign first: the unique (source, campaign id) key makes a
  // concurrent run fail here instead of creating a duplicate product.
  const { data: claimed, error: claimError } = await db
    .from('product_source_metadata')
    .upsert({ ...registryFields, pipeline_status: 'imported', last_error: null }, { onConflict: 'source,source_campaign_id' })
    .select('id, product_id')
    .single()
  if (claimError || !claimed) throw claimError ?? new Error('Could not record the campaign.')
  if (claimed.product_id) return 'skipped' as const

  let productId: string | null = null
  try {
    const hash = sourceContentHash(campaign)
    const brandId = await findOrCreateBrand(db, campaign.ownerName)
    await rememberSourceCategories(db, campaign.categories)
    const categoryId = resolveCategory(campaign.categories, mappings)

    const { data: product, error: productError } = await db
      .from('products')
      .insert({
        slug: `gf-${campaign.campaignId}`,
        // Placeholders until translated (the full Japanese text stays in the registry).
        name: clip(campaign.title!, 120),
        tagline: campaign.shortDescription ? clip(campaign.shortDescription, 200) : null,
        description: campaign.description ? clip(campaign.description, 20000) : null,
        brand_id: brandId,
        seller_id: null,
        external_url: campaign.url,
        currency: campaign.currency ?? 'JPY',
        price: campaign.price,
        availability: 'crowdfunding',
        status: 'draft',
      })
      .select('id')
      .single()
    if (productError || !product) throw productError ?? new Error('Product was not created.')
    productId = product.id

    if (categoryId) await db.from('product_categories').insert({ product_id: productId, category_id: categoryId, is_primary: true })
    const videos = ((campaign.raw.videos as string[] | undefined) ?? []).slice(0, 4)
    if (videos.length) {
      await db.from('product_videos').insert(videos.map((url, position) => ({ product_id: productId!, url, provider: /vimeo/.test(url) ? 'vimeo' : 'youtube', position })))
    }

    const images = await importCampaignImages(db, config, productId, campaign)
    await logSync(db, {
      ...base,
      productId,
      operation: 'image_import',
      status: images.errors.length ? (images.imported ? 'warning' : 'error') : 'success',
      message: `${images.imported} image(s) imported`,
      error: images.errors.join('\n') || null,
    })

    await db
      .from('product_source_metadata')
      .update({ product_id: productId, pipeline_status: 'translating', source_content_hash: hash, needs_category_review: !categoryId })
      .eq('id', claimed.id)
    await queueTranslation(db, productId, hash)
    await logSync(db, { ...base, productId, operation: 'import', status: 'success', message: `Imported as draft${categoryId ? '' : ' (category needs review)'}; translation queued`, durationMs: Date.now() - started })
    return 'new' as const
  } catch (e) {
    // Never leave a half-built product behind.
    if (productId) await db.from('products').delete().eq('id', productId)
    await db.from('product_source_metadata').update({ pipeline_status: 'sync_error', product_id: null, last_error: errorText(e) }).eq('id', claimed.id)
    throw e
  }
}

// Re-checks an imported campaign. Source data is refreshed; translations are
// never overwritten here — changed text queues a new translation job and
// flags the product as "update available".
async function updateCampaign(db: Db, config: GreenFundingConfig, runId: string, row: Registry, campaign: SourceCampaign) {
  const started = Date.now()
  const productId = row.product_id!
  const { data: images } = await db.from('product_images').select('original_url').eq('product_id', productId)
  const changed = changedFields(
    {
      ja_title: row.ja_title,
      ja_short_description: row.ja_short_description,
      ja_description: row.ja_description,
      source_status: row.source_status,
      campaign_ends_at: row.campaign_ends_at,
      source_categories: row.source_categories,
      image_urls: (images ?? []).map((i) => i.original_url).filter((u): u is string => Boolean(u)),
    },
    campaign,
  )
  // Funding figures change constantly; they are refreshed without flagging an update.
  const figures = {
    raised_amount: campaign.raisedAmount,
    backer_count: campaign.backerCount,
    days_remaining: campaign.daysRemaining,
    goal_amount: campaign.goalAmount,
    price: campaign.price,
    campaign_ends_at: campaign.endsAt,
    campaign_ends_at_estimated: campaign.endsAtEstimated,
    raw_metadata: campaign.raw as never,
    last_synced_at: new Date().toISOString(),
  }
  if (!changed.length) {
    await db.from('product_source_metadata').update(figures).eq('id', row.id)
    return 'unchanged' as const
  }

  const hash = sourceContentHash(campaign)
  const significant = changed.filter((f) => f !== 'end_date')
  await db
    .from('product_source_metadata')
    .update({
      ...figures,
      ja_title: campaign.title,
      ja_short_description: campaign.shortDescription,
      ja_description: campaign.description,
      source_status: campaign.status,
      source_categories: campaign.categories,
      source_content_hash: hash,
      changed_fields: [...new Set([...(row.changed_fields ?? []), ...changed])],
      update_available: significant.length > 0,
      source_last_updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (changed.includes('categories')) await rememberSourceCategories(db, campaign.categories)
  if (needsTranslationReview(changed) && hash !== row.translated_content_hash) await queueTranslation(db, productId, hash)
  let imageNote = ''
  if (changed.includes('images')) {
    const result = await importCampaignImages(db, config, productId, campaign)
    imageNote = `; ${result.imported} new image(s)`
    if (result.errors.length) await logSync(db, { runId, operation: 'image_import', status: 'warning', campaignId: campaign.campaignId, campaignUrl: campaign.url, productId, error: result.errors.join('\n') })
  }
  await logSync(db, {
    runId,
    operation: changed.includes('status') ? 'status_change' : 'update',
    status: changed.includes('status') && ['ended', 'cancelled'].includes(campaign.status) ? 'warning' : 'success',
    campaignId: campaign.campaignId,
    campaignUrl: campaign.url,
    productId,
    message: `Changed: ${changed.join(', ')}${changed.includes('status') ? ` (now ${campaign.status})` : ''}${imageNote}`,
    durationMs: Date.now() - started,
  })
  return 'updated' as const
}

// One synchronisation run. `trigger: 'cron'` respects the configured
// interval; `manual` (Sync Now) always runs.
export async function runSync(trigger: 'cron' | 'manual', options: { source?: CampaignSource } = {}): Promise<SyncResult> {
  const empty = { discovered: 0, newProducts: 0, updatedProducts: 0, skipped: 0, errors: 0, requests: 0 }
  const db = createServiceClient()
  if (!db) return { ran: false, reason: 'SUPABASE_SERVICE_ROLE_KEY is not configured.', ...empty }
  const config = greenFundingConfig()

  const { data: running } = await db
    .from('sync_runs')
    .select('id')
    .eq('source', SOURCE)
    .eq('status', 'running')
    .gt('started_at', new Date(Date.now() - 15 * 60_000).toISOString())
    .limit(1)
  if (running?.length) return { ran: false, reason: 'Another sync is still running.', ...empty }

  if (trigger === 'cron') {
    const { data: last } = await db.from('sync_runs').select('started_at').eq('source', SOURCE).order('started_at', { ascending: false }).limit(1).maybeSingle()
    if (!syncIsDue(last?.started_at ?? null, config.syncIntervalMinutes)) return { ran: false, reason: 'Not due yet.', ...empty }
  }

  const { data: run, error: runError } = await db.from('sync_runs').insert({ source: SOURCE, trigger, mode: config.mode }).select('id').single()
  if (runError || !run) return { ran: false, reason: `Could not start a run: ${runError?.message}`, ...empty }
  const runId = run.id
  const result: SyncResult = { ran: true, runId, mode: config.mode, ...empty }
  let source: CampaignSource
  let stopReason: string | null = null

  try {
    source = options.source ?? createCampaignSource(config)
    const { data: mappingRows } = await db.from('category_mappings').select('source_category, category_id, priority').eq('source', SOURCE)
    const mappings = (mappingRows ?? []) as CategoryMapping[]

    // 1. New campaigns.
    const refs = await source.listNewCampaigns()
    result.discovered = refs.length
    await logSync(db, { runId, operation: 'discover', status: 'success', message: `${refs.length} campaign(s) on the newest listing page(s)` })
    const { data: known } = refs.length
      ? await db.from('product_source_metadata').select(REGISTRY_COLUMNS).eq('source', SOURCE).in('source_campaign_id', refs.map((r) => r.campaignId))
      : { data: [] as Registry[] }
    const byId = new Map(((known ?? []) as Registry[]).map((r) => [r.source_campaign_id, r]))
    const touched = new Set<string>()

    for (const ref of refs) {
      if (actionForListedCampaign(byId.get(ref.campaignId) ?? null) === 'skip') {
        result.skipped++
        continue
      }
      touched.add(ref.campaignId)
      const started = Date.now()
      try {
        const campaign = await source.fetchCampaign(ref)
        const outcome = await importCampaign(db, config, runId, campaign, mappings)
        if (outcome === 'new') result.newProducts++
        else result.skipped++
      } catch (e) {
        if (e instanceof RequestBudgetExceeded || (e instanceof SourceError && /stopping this run/.test(e.message))) {
          stopReason = e.message
          break
        }
        result.errors++
        await logSync(db, { runId, operation: 'import', status: 'error', campaignId: ref.campaignId, campaignUrl: ref.url, error: errorText(e), durationMs: Date.now() - started })
      }
    }

    // 2. Updates to campaigns we already have (oldest check first).
    if (!stopReason && config.updateChecksPerRun > 0) {
      const { data: rows } = await db
        .from('product_source_metadata')
        .select(REGISTRY_COLUMNS)
        .eq('source', SOURCE)
        .not('product_id', 'is', null)
        .order('last_synced_at', { ascending: true, nullsFirst: true })
        .limit(config.updateChecksPerRun + touched.size)
      for (const row of ((rows ?? []) as Registry[]).filter((r) => shouldCheckForUpdates(r) && !touched.has(r.source_campaign_id)).slice(0, config.updateChecksPerRun)) {
        const started = Date.now()
        try {
          const campaign = await source.fetchCampaign({ campaignId: row.source_campaign_id, url: row.source_url })
          const outcome = await updateCampaign(db, config, runId, row, campaign)
          if (outcome === 'updated') result.updatedProducts++
        } catch (e) {
          if (e instanceof RequestBudgetExceeded || (e instanceof SourceError && /stopping this run/.test(e.message))) {
            stopReason = e.message
            break
          }
          // A campaign page that disappeared is a status change, not a crash.
          if (e instanceof SourceError && !e.retryable) {
            await db.from('product_source_metadata').update({ source_status: 'ended', update_available: true, changed_fields: [...new Set([...(row.changed_fields ?? []), 'status'])], last_synced_at: new Date().toISOString(), last_error: e.message }).eq('id', row.id)
            await logSync(db, { runId, operation: 'status_change', status: 'warning', campaignId: row.source_campaign_id, campaignUrl: row.source_url, productId: row.product_id, message: 'Campaign page is no longer available', error: e.message, durationMs: Date.now() - started })
            continue
          }
          result.errors++
          await logSync(db, { runId, operation: 'update', status: 'error', campaignId: row.source_campaign_id, campaignUrl: row.source_url, productId: row.product_id, error: errorText(e), durationMs: Date.now() - started })
        }
      }
    }
    result.requests = source.requestCount
  } catch (e) {
    result.errors++
    await logSync(db, { runId, operation: 'sync', status: 'error', error: errorText(e) })
  }

  if (stopReason) await logSync(db, { runId, operation: 'sync', status: 'warning', message: `Stopped early: ${stopReason}` })
  const status = result.errors ? (result.newProducts || result.updatedProducts ? 'warning' : 'error') : stopReason ? 'warning' : 'success'
  await db
    .from('sync_runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      discovered: result.discovered,
      new_count: result.newProducts,
      updated_count: result.updatedProducts,
      skipped_count: result.skipped,
      error_count: result.errors,
      requests: result.requests,
      message: stopReason,
    })
    .eq('id', runId)
  return result
}
