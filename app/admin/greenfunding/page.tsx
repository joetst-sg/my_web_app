import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, RefreshCw, ScrollText, Sprout } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, StatusPill } from '@/components/common/basics'
import { ActionButton } from '@/components/admin/action-button'
import { Button } from '@/components/ui/button'
import { requireAdmin } from '@/lib/auth'
import { approveAndPublish, rejectImport, syncNow, translateNow } from '@/lib/actions/greenfunding'
import { greenFundingConfig } from '@/lib/greenfunding/config'
import { translationConfig } from '@/lib/translation'
import { productImageUrl } from '@/lib/images'
import { createClient } from '@/lib/supabase/server'
import { MappingRow } from './mapping-form'
import { CampaignPill, fmtDate, PipelinePill, translationState } from './shared'

export const metadata: Metadata = { title: 'GREEN FUNDING' }
// Sync Now / Translate now run in this request.
export const maxDuration = 300

const FILTERS = [
  ['all', 'All', null],
  ['new', 'New imports', ['imported', 'translating']],
  ['review', 'Pending review', ['pending_review', 'draft', 'approved']],
  ['published', 'Published', ['published']],
  ['rejected', 'Rejected', ['rejected', 'archived']],
  ['errors', 'Sync errors', ['sync_error']],
  ['skipped', 'Not eligible', ['not_eligible']],
] as const

export default async function GreenFundingPage({ searchParams }: PageProps<'/admin/greenfunding'>) {
  await requireAdmin()
  const sp = await searchParams
  const filter = FILTERS.find(([k]) => k === sp.filter) ?? FILTERS[0]
  const updatesOnly = sp.filter === 'updates'
  const config = greenFundingConfig()
  const tconfig = translationConfig()
  const supabase = await createClient()

  let q = supabase
    .from('product_source_metadata')
    .select('id, product_id, source_url, source_campaign_id, source_status, pipeline_status, ja_title, created_at, update_available, needs_category_review, last_error, translated_content_hash, product:products ( id, name, slug, status, translations, images:product_images ( storage_path, position ) )')
    .eq('source', 'greenfunding')
  if (updatesOnly) q = q.eq('update_available', true)
  else if (filter[2]) q = q.in('pipeline_status', [...filter[2]])
  else q = q.neq('pipeline_status', 'not_eligible')

  const [{ data: rows }, { data: counts }, { data: lastRun }, { data: jobs }, { data: mappings }, { data: categories }] = await Promise.all([
    q.order('created_at', { ascending: false }).limit(100),
    supabase.from('product_source_metadata').select('pipeline_status, update_available, product_id').eq('source', 'greenfunding'),
    supabase.from('sync_runs').select('*').eq('source', 'greenfunding').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('translation_jobs').select('product_id, status, attempts, max_attempts, created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('category_mappings').select('source_category, category_id, priority').eq('source', 'greenfunding').order('priority').order('source_category'),
    supabase.from('categories').select('id, name, parent_id, sort_order').order('sort_order'),
  ])

  const count = (statuses: string[]) => (counts ?? []).filter((c) => statuses.includes(c.pipeline_status)).length
  const latestJob = new Map<string, NonNullable<typeof jobs>[number]>()
  for (const j of jobs ?? []) if (!latestJob.has(j.product_id)) latestJob.set(j.product_id, j)
  const nextSync = lastRun ? new Date(Date.parse(lastRun.started_at) + config.syncIntervalMinutes * 60_000).toISOString() : null
  const stats = [
    ['New imports', count(['imported', 'translating'])],
    ['Pending review', count(['pending_review', 'draft', 'approved'])],
    ['Published', count(['published'])],
    ['Rejected', count(['rejected', 'archived'])],
    ['Sync errors', count(['sync_error'])],
    ['Updates available', (counts ?? []).filter((c) => c.update_available).length],
    ['Products imported', (counts ?? []).filter((c) => c.product_id).length],
    ['Awaiting translation', (jobs ?? []).filter((j) => j.status === 'queued' || j.status === 'running').length],
  ] as const

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Import</p>
          <h1 className="font-display text-3xl font-bold">GREEN FUNDING</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {config.mode === 'production' && config.autoPublish
              ? 'New campaigns are imported, translated to English and Traditional Chinese, and published automatically once the safety checks pass. Anything that fails a check waits here for review.'
              : 'New campaigns are imported as hidden drafts, translated to English and Traditional Chinese, and wait here for review. Nothing is public until you approve it.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost"><Link href="/admin/greenfunding/logs"><ScrollText />Sync log</Link></Button>
          <ActionButton action={translateNow}>Translate now</ActionButton>
          <ActionButton action={syncNow} variant="default"><RefreshCw />Sync now</ActionButton>
        </div>
      </div>

      <div className={cn('rounded-2xl border p-4 text-sm', config.mode === 'test' ? 'border-[oklch(0.8_0.12_80)] bg-[oklch(0.97_0.04_85)]' : 'bg-surface')}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span><strong>Mode:</strong> {config.mode === 'test' ? 'TEST — imports and translates, never publishes' : config.autoPublish ? 'Production · auto-publish ON (published as soon as translated)' : 'Production · manual review'}</span>
          <span><strong>Last sync:</strong> {lastRun ? `${fmtDate(lastRun.finished_at ?? lastRun.started_at)} (${lastRun.status})` : 'never'}</span>
          <span><strong>Next sync:</strong> {nextSync ? `≈ ${fmtDate(nextSync)}` : 'on the next scheduler tick'} · every {config.syncIntervalMinutes} min</span>
          <span><strong>Translation:</strong> {tconfig.apiKey ? `${tconfig.provider} · ${tconfig.model}` : <span className="text-destructive">no TRANSLATION_API_KEY set</span>}</span>
        </div>
        {lastRun && (
          <p className="mt-2 text-muted-foreground">
            Last run: {lastRun.discovered} found · {lastRun.new_count} new · {lastRun.updated_count} updated · {lastRun.skipped_count} skipped · {lastRun.error_count} errors · {lastRun.requests} requests{lastRun.message ? ` · ${lastRun.message}` : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-background p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <nav className="flex flex-wrap gap-1" aria-label="Filter imports">
          {[...FILTERS.map(([k, label]) => [k, label] as const), ['updates', 'Update available'] as const].map(([k, label]) => {
            const active = k === 'updates' ? updatesOnly : !updatesOnly && filter[0] === k
            return (
              <Link key={k} href={k === 'all' ? '/admin/greenfunding' : `/admin/greenfunding?filter=${k}`} className={cn('rounded-full px-3 py-1.5 text-sm', active ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>
                {label}
              </Link>
            )
          })}
        </nav>

        {(rows ?? []).length === 0 ? (
          <EmptyState icon={Sprout} title="Nothing here yet" description="Click “Sync now” to check GREEN FUNDING for new campaigns." />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows!.map((r) => {
              const p = r.product
              const img = p ? [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0] : null
              const zh = (p?.translations as Record<string, Record<string, string>> | null)?.['zh-HK']
              const translated = Boolean(r.translated_content_hash)
              const ts = translationState(p ? latestJob.get(p.id) : undefined, translated)
              return (
                <li key={r.id} className="flex flex-col gap-3 rounded-2xl border bg-background p-4 lg:flex-row lg:items-center">
                  <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-muted lg:w-36">
                    {img && <Image src={productImageUrl(img.storage_path)!} alt="" fill sizes="144px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PipelinePill status={r.pipeline_status} />
                      <CampaignPill status={r.source_status} />
                      <StatusPill tone={ts.tone}>{ts.label}</StatusPill>
                      {p && <StatusPill tone={p.status === 'published' ? 'success' : 'neutral'}>{p.status === 'published' ? 'Public' : 'Hidden'}</StatusPill>}
                      {r.update_available && <StatusPill tone="accent">Update available</StatusPill>}
                      {r.needs_category_review && <StatusPill tone="warning">Uncategorized</StatusPill>}
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm text-muted-foreground" lang="ja">🇯🇵 {r.ja_title ?? '—'}</p>
                    <p className="line-clamp-1 font-medium">🇬🇧 {translated ? p?.name : <span className="text-muted-foreground">not translated yet</span>}</p>
                    <p className="line-clamp-1 text-sm" lang="zh-HK">繁 {zh?.name ?? <span className="text-muted-foreground">—</span>}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      #{r.source_campaign_id} · imported {fmtDate(r.created_at)} · <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline">{r.source_url}</a>
                    </p>
                    {r.last_error && r.pipeline_status !== 'published' && <p className="mt-1 text-xs text-destructive">{r.last_error}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 lg:w-56 lg:flex-col">
                    {p && <Button asChild size="sm"><Link href={`/admin/greenfunding/${p.id}`}>Review / Edit</Link></Button>}
                    {p && p.status !== 'published' && translated && (
                      <ActionButton action={approveAndPublish.bind(null, p.id)} size="sm" confirm={{ title: 'Approve and publish?', description: 'The product becomes public in English and Traditional Chinese, with Buy Now linking to the GREEN FUNDING campaign.', confirmLabel: 'Approve & publish' }}>
                        Approve &amp; Publish
                      </ActionButton>
                    )}
                    {p && !['rejected', 'archived'].includes(r.pipeline_status) && (
                      <ActionButton action={rejectImport.bind(null, p.id, undefined)} size="sm" variant="ghost" confirm={{ title: 'Reject this import?', description: 'It is hidden and will not be imported again.', confirmLabel: 'Reject' }}>
                        Reject
                      </ActionButton>
                    )}
                    <Button asChild size="sm" variant="ghost"><a href={r.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink />Open GREEN FUNDING</a></Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-background p-5">
        <h2 className="font-sans text-base font-semibold tracking-normal">Category mapping</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          GREEN FUNDING categories → site categories. When a campaign has several, the first mapped one in this list wins. Unmapped categories leave the product “Uncategorized” for you to choose during review. New GREEN FUNDING categories appear here automatically.
        </p>
        <div className="divide-y">
          {(mappings ?? []).map((m) => <MappingRow key={m.source_category} label={m.source_category} categoryId={m.category_id} categories={categories ?? []} />)}
        </div>
      </section>
    </div>
  )
}
