import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'
import { greenFundingConfig } from './config'
import { logSync } from './sync'
import { sourceDefinition } from './sources'
import { validateSourceUrl } from './url'

type Db = NonNullable<ReturnType<typeof createServiceClient>>

export type PublishResult = { ok: true; slug: string } | { ok: false; error: string }

// Publishes an imported GREEN FUNDING product. Used by "Approve & Publish"
// and by automatic publishing; both go through the same checks:
//  - production mode,
//  - a valid HTTPS campaign URL on an authorized domain,
//  - Buy Now URL identical to the imported campaign URL,
//  - finished English and Traditional Chinese titles,
//  - a campaign that hasn't ended or been cancelled,
//  - a category (manual approval only; automatic publishing allows
//    uncategorized products and leaves them flagged for review).
export async function publishImport(
  db: Db,
  productId: string,
  by: { kind: 'admin'; id: string; email: string | null } | { kind: 'auto' },
): Promise<PublishResult> {
  const config = greenFundingConfig()
  if (config.mode !== 'production') return { ok: false, error: 'Test mode: publishing is disabled. Set GREEN_FUNDING_IMPORT_MODE=production to publish.' }

  const [{ data: meta }, { data: product }, { data: cats }] = await Promise.all([
    db.from('product_source_metadata').select('id, source, source_url, source_campaign_id, source_status, translated_content_hash').eq('product_id', productId).maybeSingle(),
    db.from('products').select('id, slug, name, status, external_url, brand_id, translations').eq('id', productId).maybeSingle(),
    db.from('product_categories').select('category_id').eq('product_id', productId),
  ])
  if (!meta || !product) return { ok: false, error: 'This is not an imported GREEN FUNDING product.' }
  if (product.status === 'published') return { ok: true, slug: product.slug }

  const def = sourceDefinition(meta.source)
  if (!def) return { ok: false, error: `Unknown source "${meta.source}".` }
  const check = validateSourceUrl(meta.source_url, def.config.allowedDomains, def.campaignPath)
  if (!check.ok) return { ok: false, error: `Campaign URL rejected: ${check.reason}` }
  if (product.external_url !== meta.source_url) return { ok: false, error: 'The Buy Now URL does not match the imported campaign URL. Fix the campaign URL first.' }
  if (!meta.translated_content_hash) return { ok: false, error: 'Translations are not ready yet.' }
  const zh = (product.translations as Record<string, Record<string, string>> | null)?.['zh-HK']
  if (!product.name || !zh?.name) return { ok: false, error: 'English and Traditional Chinese titles are both required.' }
  if (['ended', 'cancelled'].includes(meta.source_status)) return { ok: false, error: `The campaign has ${meta.source_status === 'ended' ? 'ended' : 'been cancelled'}.` }
  const { count: images } = await db.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId)
  if (!images) return { ok: false, error: 'The product has no image.' }
  const hasCategory = Boolean(cats?.length)
  if (by.kind === 'admin' && !hasCategory) return { ok: false, error: 'Choose a category before publishing.' }

  const now = new Date().toISOString()
  const { error } = await db.from('products').update({ status: 'published', published_at: now, availability: 'crowdfunding' }).eq('id', productId)
  if (error) return { ok: false, error: error.message }
  if (product.brand_id) await db.from('brands').update({ is_published: true }).eq('id', product.brand_id)
  await db
    .from('product_source_metadata')
    .update({
      pipeline_status: 'published',
      update_available: false,
      changed_fields: [],
      needs_category_review: !hasCategory,
      ...(by.kind === 'admin' ? { reviewed_by: by.id, reviewed_at: now } : {}),
    })
    .eq('id', meta.id)
  await logSync(db, {
    source: meta.source,
    operation: 'publish',
    status: 'success',
    campaignId: meta.source_campaign_id,
    campaignUrl: meta.source_url,
    productId,
    message: by.kind === 'admin' ? `Approved and published by ${by.email}` : `Published automatically (GREEN_FUNDING_AUTO_PUBLISH)${hasCategory ? '' : ' — uncategorized, please choose a category'}`,
  })
  await db.from('audit_logs').insert({
    actor_id: by.kind === 'admin' ? by.id : null,
    action: by.kind === 'admin' ? 'greenfunding.publish' : 'greenfunding.auto_publish',
    entity_type: 'product',
    entity_id: productId,
    metadata: { campaign_id: meta.source_campaign_id },
  })
  return { ok: true, slug: product.slug }
}

// Called after a translation has been applied: publishes right away when
// automatic publishing is switched on. Failures leave the product in review
// and are logged with the reason.
export async function autoPublishIfEnabled(db: Db, productId: string) {
  const config = greenFundingConfig()
  if (!config.autoPublish || config.mode !== 'production') return null
  const { data: meta } = await db.from('product_source_metadata').select('id, source, source_campaign_id, source_url').eq('product_id', productId).maybeSingle()
  const log = { source: meta?.source, campaignId: meta?.source_campaign_id, campaignUrl: meta?.source_url, productId }

  // Conservative duplicate check: a possible match with an already published
  // product is held back instead of published.
  const { data: dupes } = await db.rpc('crowdfunding_duplicate_candidates', { _product_id: productId })
  if (dupes?.length) {
    const reason = `Possible duplicate of ${dupes.map((d) => `“${d.name}” (${d.reason})`).join(', ')}`
    if (meta) await db.from('product_source_metadata').update({ pipeline_status: 'duplicate', last_error: reason.slice(0, 2000) }).eq('id', meta.id)
    await logSync(db, { ...log, operation: 'publish', status: 'warning', message: 'Not published — possible duplicate', error: reason })
    return { ok: false as const, error: reason }
  }

  const res = await publishImport(db, productId, { kind: 'auto' })
  if (!res.ok && meta) {
    await db.from('product_source_metadata').update({ pipeline_status: 'failed', last_error: `Not published automatically: ${res.error}` }).eq('id', meta.id)
    await logSync(db, { ...log, operation: 'publish', status: 'warning', message: 'Not published automatically — validation failed', error: res.error })
  }
  return res
}
