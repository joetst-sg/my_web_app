import type { Metadata } from 'next'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { StatusPill } from '@/components/common/basics'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fmtDate } from '../shared'

export const metadata: Metadata = { title: 'GREEN FUNDING sync log' }

const PAGE = 100
const tone = { success: 'success', warning: 'warning', error: 'danger' } as const

export default async function SyncLogPage({ searchParams }: PageProps<'/admin/greenfunding/logs'>) {
  await requireAdmin()
  const sp = await searchParams
  const status = sp.status === 'error' || sp.status === 'warning' ? sp.status : null
  const page = Math.max(1, Number(sp.page) || 1)
  const supabase = await createClient()
  let q = supabase.from('sync_logs').select('id, created_at, campaign_id, campaign_url, operation, status, message, error_message, duration_ms, product_id', { count: 'exact' }).eq('source', 'greenfunding')
  if (status) q = q.eq('status', status)
  const [{ data, count }, { data: runs }] = await Promise.all([
    q.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    supabase.from('sync_runs').select('*').eq('source', 'greenfunding').order('started_at', { ascending: false }).limit(10),
  ])
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow"><Link href="/admin/greenfunding" className="hover:text-foreground">GREEN FUNDING</Link></p>
          <h1 className="font-display text-3xl font-bold">Sync log</h1>
        </div>
        <nav className="flex gap-1" aria-label="Filter log">
          {[[null, 'All'], ['warning', 'Warnings'], ['error', 'Errors']].map(([s, label]) => (
            <Link key={label} href={s ? `/admin/greenfunding/logs?status=${s}` : '/admin/greenfunding/logs'} className={cn('rounded-full px-3 py-1.5 text-sm', status === s ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>{label}</Link>
          ))}
        </nav>
      </div>

      <section className="overflow-x-auto rounded-2xl border bg-background">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="p-3 text-left font-semibold">Recent runs</caption>
          <thead className="text-left text-xs text-muted-foreground"><tr>{['Started', 'Trigger', 'Mode', 'Status', 'Found', 'New', 'Updated', 'Skipped', 'Errors', 'Requests', 'Duration'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y tabular-nums">
            {(runs ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.started_at)}</td>
                <td className="px-3">{r.trigger}</td>
                <td className="px-3">{r.mode}</td>
                <td className="px-3"><StatusPill tone={r.status === 'running' ? 'info' : tone[r.status as keyof typeof tone]}>{r.status}</StatusPill></td>
                <td className="px-3">{r.discovered}</td><td className="px-3">{r.new_count}</td><td className="px-3">{r.updated_count}</td><td className="px-3">{r.skipped_count}</td><td className="px-3">{r.error_count}</td><td className="px-3">{r.requests}</td>
                <td className="px-3">{r.finished_at ? `${Math.round((Date.parse(r.finished_at) - Date.parse(r.started_at)) / 1000)} s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-2xl border bg-background">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr>{['Timestamp', 'Campaign', 'Action', 'Status', 'Details', 'Duration'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {(data ?? []).map((l) => (
              <tr key={l.id} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                <td className="px-3 py-2">
                  {l.campaign_id ? <a href={l.campaign_url ?? '#'} target="_blank" rel="noopener noreferrer" className="underline">#{l.campaign_id}</a> : '—'}
                  {l.product_id && <> · <Link href={`/admin/greenfunding/${l.product_id}`} className="underline">review</Link></>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{l.operation.replace('_', ' ')}</td>
                <td className="px-3 py-2"><StatusPill tone={tone[l.status as keyof typeof tone]}>{l.status.toUpperCase()}</StatusPill></td>
                <td className="max-w-xl px-3 py-2">
                  {l.message && <p>{l.message}</p>}
                  {l.error_message && <p className="whitespace-pre-wrap break-words text-xs text-destructive">{l.error_message}</p>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{l.duration_ms !== null ? `${(l.duration_ms / 1000).toFixed(1)} s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data ?? []).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No log entries yet.</p>}
      </section>
      {pages > 1 && (
        <nav className="flex justify-center gap-2" aria-label="Pages">
          {page > 1 && <Link className="underline" href={`/admin/greenfunding/logs?${new URLSearchParams({ ...(status && { status }), page: String(page - 1) })}`}>Newer</Link>}
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          {page < pages && <Link className="underline" href={`/admin/greenfunding/logs?${new URLSearchParams({ ...(status && { status }), page: String(page + 1) })}`}>Older</Link>}
        </nav>
      )}
    </div>
  )
}
