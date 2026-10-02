import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { StatusPill } from '@/components/common/basics'
import { ActionButton } from '@/components/admin/action-button'
import { Button } from '@/components/ui/button'
import { requireAdmin } from '@/lib/auth'
import {
  applyLatestAiTranslation, approveAndPublish, archiveImport, dismissUpdate, rejectImport, reopenImport, retranslate,
} from '@/lib/actions/greenfunding'
import { greenFundingConfig } from '@/lib/greenfunding/config'
import { productImageUrl } from '@/lib/images'
import { createClient } from '@/lib/supabase/server'
import { ProductCategoryPicker } from '../mapping-form'
import { CampaignPill, fmtDate, PipelinePill, translationState, yen } from '../shared'
import { CampaignUrlEditor, TranslationEditor, type Texts } from './translation-editor'

export const metadata: Metadata = { title: 'Review GREEN FUNDING import' }

const texts = (o: { name?: string | null; title?: string | null; tagline?: string | null; short_description?: string | null; description?: string | null; seo_title?: string | null; seo_description?: string | null } | null | undefined): Texts => ({
  title: o?.name ?? o?.title ?? '',
  short_description: o?.tagline ?? o?.short_description ?? '',
  description: o?.description ?? '',
  seo_title: o?.seo_title ?? '',
  seo_description: o?.seo_description ?? '',
})

export default async function ReviewImportPage({ params }: PageProps<'/admin/greenfunding/[id]'>) {
  await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const [{ data: meta }, { data: product }, { data: versions }, { data: job }, { data: categories }] = await Promise.all([
    supabase.from('product_source_metadata').select('*').eq('product_id', id).maybeSingle(),
    supabase
      .from('products')
      .select('id, slug, name, tagline, description, seo_title, seo_description, translations, status, external_url, published_at, brand:brands ( name ), images:product_images ( id, storage_path, alt, translations, original_url, position ), categories:product_categories ( category_id, is_primary ), videos:product_videos ( url )')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('product_translation_versions').select('id, language, version, origin, translation_provider, translation_model, translated_at, title').eq('product_id', id).order('translated_at', { ascending: false }).limit(30),
    supabase.from('translation_jobs').select('status, attempts, max_attempts, last_error, run_after').eq('product_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('categories').select('id, name, parent_id, sort_order').order('sort_order'),
  ])
  if (!meta || !product) notFound()
  const zh = (product.translations as Record<string, Record<string, string | null>> | null)?.['zh-HK']
  const translated = Boolean(meta.translated_content_hash)
  const ts = translationState(job ?? undefined, translated)
  const images = [...(product.images ?? [])].sort((a, b) => a.position - b.position)
  const categoryId = product.categories?.find((c) => c.is_primary)?.category_id ?? product.categories?.[0]?.category_id ?? null
  const mode = greenFundingConfig().mode
  const urlMatches = product.external_url === meta.source_url

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow"><Link href="/admin/greenfunding" className="hover:text-foreground">GREEN FUNDING</Link> · #{meta.source_campaign_id}</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{translated ? product.name : meta.ja_title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <PipelinePill status={meta.pipeline_status} />
            <CampaignPill status={meta.source_status} />
            <StatusPill tone={ts.tone}>{ts.label}</StatusPill>
            <StatusPill tone={product.status === 'published' ? 'success' : 'neutral'}>{product.status === 'published' ? 'Public' : `Hidden (${product.status})`}</StatusPill>
            {meta.update_available && <StatusPill tone="accent">Update available</StatusPill>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {product.status === 'published' && <Button asChild variant="ghost"><Link href={`/products/${product.slug}`} target="_blank">View live</Link></Button>}
          <Button asChild variant="ghost"><a href={meta.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink />Open GREEN FUNDING</a></Button>
          {product.status !== 'published' && (
            <ActionButton
              action={approveAndPublish.bind(null, product.id)}
              variant="default"
              confirm={{ title: 'Approve and publish?', description: 'The product becomes public in English and Traditional Chinese. Buy Now links to the exact GREEN FUNDING campaign URL shown below.', confirmLabel: 'Approve & publish' }}
            >
              Approve &amp; Publish
            </ActionButton>
          )}
          {['rejected', 'archived'].includes(meta.pipeline_status) ? (
            <ActionButton action={reopenImport.bind(null, product.id)}>Move back to review</ActionButton>
          ) : product.status === 'published' ? (
            <ActionButton action={archiveImport.bind(null, product.id)} variant="ghost" confirm={{ title: 'Unpublish and archive?', confirmLabel: 'Archive' }}>Unpublish</ActionButton>
          ) : (
            <ActionButton action={rejectImport.bind(null, product.id, undefined)} variant="ghost" confirm={{ title: 'Reject this import?', description: 'It is hidden and will not be imported again.', confirmLabel: 'Reject' }}>Reject</ActionButton>
          )}
        </div>
      </div>

      {mode === 'test' && (
        <p className="rounded-xl border border-[oklch(0.8_0.12_80)] bg-[oklch(0.97_0.04_85)] px-4 py-3 text-sm">Test mode: you can review and edit, but publishing is disabled until GREEN_FUNDING_IMPORT_MODE=production.</p>
      )}
      {meta.update_available && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[oklch(0.75_0.1_300)] bg-[oklch(0.97_0.03_300)] px-4 py-3 text-sm">
          <p><strong>Update available:</strong> GREEN FUNDING changed {meta.changed_fields.join(', ') || 'this campaign'}. Your published text was not changed. Review the new source text and the latest AI version.</p>
          <div className="flex gap-2">
            <ActionButton action={applyLatestAiTranslation.bind(null, product.id)} size="sm" confirm={{ title: 'Replace the current English and Chinese text with the latest AI translation?', confirmLabel: 'Apply' }}>Apply latest AI translation</ActionButton>
            <ActionButton action={dismissUpdate.bind(null, product.id)} size="sm" variant="ghost">Dismiss</ActionButton>
          </div>
        </div>
      )}
      {job?.status === 'failed' && !translated && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">Translation failed after {job.attempts} attempt(s): {job.last_error}</p>
      )}

      <section className="grid gap-4 rounded-2xl border bg-background p-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs text-muted-foreground">GREEN FUNDING campaign URL (Buy Now destination)</p>
            <CampaignUrlEditor productId={product.id} url={meta.source_url} />
            {!urlMatches && <p className="mt-1 text-sm text-destructive">Buy Now URL ({product.external_url ?? 'none'}) does not match the campaign URL.</p>}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Category {meta.needs_category_review && <span className="text-destructive">— uncategorized, please choose</span>}</p>
            <ProductCategoryPicker productId={product.id} categoryId={categoryId} categories={categories ?? []} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">GREEN FUNDING categories / tags</p>
            <p className="text-sm" lang="ja">{meta.source_categories.join(' · ') || '—'}{meta.source_tags.length ? ` · tags: ${meta.source_tags.join(', ')}` : ''}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Brand / owner</dt><dd>{product.brand?.name ?? meta.owner_name ?? '—'}</dd>
          <dt className="text-muted-foreground">Lowest plan price</dt><dd>{yen(meta.price, meta.currency ?? 'JPY')}</dd>
          <dt className="text-muted-foreground">Goal</dt><dd>{yen(meta.goal_amount, meta.currency ?? 'JPY')}</dd>
          <dt className="text-muted-foreground">Raised</dt><dd>{yen(meta.raised_amount, meta.currency ?? 'JPY')}</dd>
          <dt className="text-muted-foreground">Backers</dt><dd>{meta.backer_count ?? '—'}</dd>
          <dt className="text-muted-foreground">Ends</dt><dd>{meta.campaign_ends_at ? `${fmtDate(meta.campaign_ends_at)}${meta.campaign_ends_at_estimated ? ' (estimated from days left)' : ''}` : '—'}</dd>
          <dt className="text-muted-foreground">Imported</dt><dd>{fmtDate(meta.created_at)}</dd>
          <dt className="text-muted-foreground">Last checked</dt><dd>{fmtDate(meta.last_synced_at)}</dd>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-semibold tracking-normal">Images ({images.length})</h2>
        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">No images were imported.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {images.map((img) => (
              <li key={img.id} className="flex flex-col gap-1">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                  <Image src={productImageUrl(img.storage_path)!} alt={img.alt ?? ''} fill sizes="200px" className="object-cover" />
                </div>
                <p className="line-clamp-2 text-[0.7rem] text-muted-foreground">EN: {img.alt ?? '—'}</p>
                <p className="line-clamp-2 text-[0.7rem] text-muted-foreground" lang="zh-HK">繁: {(img.translations as Record<string, { alt?: string }> | null)?.['zh-HK']?.alt ?? '—'}</p>
              </li>
            ))}
          </ul>
        )}
        {(product.videos ?? []).length > 0 && <p className="text-sm text-muted-foreground">{product.videos!.length} video(s) linked from the campaign.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-lg font-semibold tracking-normal">Content</h2>
          <ActionButton action={retranslate.bind(null, product.id)} size="sm" variant="ghost" confirm={{ title: 'Generate a new AI translation?', description: 'Uses one AI request per language. Your current text stays until you apply the new version.', confirmLabel: 'Queue translation' }}>Re-translate</ActionButton>
        </div>
        <TranslationEditor
          key={JSON.stringify([product.name, zh?.name, meta.source_content_hash, meta.ja_summary])}
          productId={product.id}
          source={{ title: meta.ja_title, short_description: meta.ja_short_description, description: meta.ja_description, summary: meta.ja_summary, summaryEdited: meta.ja_summary_edited }}
          en={translated ? texts(product) : texts(null)}
          zh={texts(zh as never)}
        />
      </section>

      <section className="rounded-2xl border bg-background p-5">
        <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Translation history</h2>
        {(versions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No translations yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 font-medium">When</th><th className="font-medium">Language</th><th className="font-medium">Version</th><th className="font-medium">By</th><th className="font-medium">Title</th></tr></thead>
            <tbody className="divide-y">
              {versions!.map((v) => (
                <tr key={v.id}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(v.translated_at)}</td>
                  <td className="pr-3">{v.language === 'en' ? 'English' : '繁體中文'}</td>
                  <td className="pr-3">v{v.version}</td>
                  <td className="pr-3 whitespace-nowrap">{v.origin === 'ai' ? `AI · ${v.translation_provider} · ${v.translation_model}` : 'Admin edit'}</td>
                  <td className="line-clamp-1">{v.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
