import type { Metadata } from 'next'
import Link from 'next/link'
import { DailyBarChart, lastNDays } from '@/components/common/bar-chart'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { compactNumber, timeAgo } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dashboard' }

type Summary = { totals: Record<string, number> | null; daily: { day: string; views: number; clicks: number; saves: number }[] }

export default async function AdminDashboard() {
  const supabase = await createClient()
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0)
  const [queue, changes, scheduled, published, openReports, { data: summary }, { data: recent }] = await Promise.all([
    count(supabase.from('submissions').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'under_review'])),
    count(supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'changes_requested')),
    count(supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'scheduled')),
    count(supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'published')),
    count(supabase.from('reports').select('*', { count: 'exact', head: true }).in('status', ['open', 'reviewing'])),
    supabase.rpc('analytics_summary', { days: 14 }),
    supabase.from('submissions').select('id, status, last_action_at, product:products ( name )').in('status', ['submitted', 'under_review']).order('submitted_at').limit(8),
  ])
  const s = (summary ?? { totals: {}, daily: [] }) as Summary
  const byDay = new Map(s.daily.map((d) => [d.day, d]))
  const tiles = [
    ['Waiting for review', queue, '/admin/submissions?status=queue'],
    ['Changes requested', changes, '/admin/submissions?status=changes_requested'],
    ['Scheduled', scheduled, '/admin/submissions?status=scheduled'],
    ['Published products', published, '/admin/products?status=published'],
    ['Open reports', openReports, '/admin/reports'],
  ] as const

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-bold">Editorial dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([label, value, href]) => (
          <Link key={label} href={href} className="rounded-2xl border bg-background p-4 hover:border-foreground/30">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border bg-background p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-sans text-base font-semibold tracking-normal">Last 14 days</h2>
            <p className="text-sm text-muted-foreground">
              {compactNumber(s.totals?.product_view)} views · {compactNumber(s.totals?.buy_click)} outbound clicks · {compactNumber(s.totals?.product_save)} saves
            </p>
          </div>
          <DailyBarChart
            label="Site-wide product views, outbound clicks and saves per day"
            data={lastNDays(14).map((day) => ({ day, values: byDay.get(day) ?? {} }))}
            series={[{ key: 'views', label: 'Views', color: 'var(--chart-2)' }, { key: 'clicks', label: 'Outbound clicks', color: 'var(--chart-1)' }, { key: 'saves', label: 'Saves', color: 'var(--chart-3)' }]}
          />
        </section>
        <section className="rounded-2xl border bg-background">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-sans text-base font-semibold tracking-normal">Review queue (oldest first)</h2>
            <Link href="/admin/submissions" className="text-sm underline underline-offset-4">All</Link>
          </div>
          {(recent ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">The queue is empty.</p>
          ) : (
            <ul className="divide-y">
              {recent!.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/submissions/${r.id}`} className="flex items-center gap-3 p-4 hover:bg-surface">
                    <span className="min-w-0 flex-1 truncate font-medium">{r.product?.name}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(r.last_action_at)}</span>
                    <SubmissionStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
