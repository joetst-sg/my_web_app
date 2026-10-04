import type { Metadata } from 'next'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { DailyBarChart, lastNDays } from '@/components/common/bar-chart'
import { compactNumber } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Analytics' }

type Row = { name: string; slug: string }
type Summary = {
  totals: Record<string, number> | null
  daily: { day: string; views: number; clicks: number; saves: number }[]
  top_products: (Row & { id: string; views: number; clicks: number; saves: number; shares: number })[]
  top_categories: (Row & { events: number })[]
  top_brands: (Row & { events: number })[]
  top_searches: { query: string; searches: number }[]
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps<'/admin/analytics'>) {
  const sp = await searchParams
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30
  const supabase = await createClient()
  const { data } = await supabase.rpc('analytics_summary', { days })
  const s = (data ?? {}) as Summary
  const t = s.totals ?? {}
  const views = t.product_view ?? 0
  const clicks = t.buy_click ?? 0
  const byDay = new Map((s.daily ?? []).map((d) => [d.day, d]))
  const kpis = [
    ['Product views', views], ['Buy clicks', clicks], ['Conversion to seller site', views ? `${((clicks / views) * 100).toFixed(1)}%` : '—'],
    ['Saves', t.product_save ?? 0], ['Shares', t.product_share ?? 0],
    ['Searches', t.search ?? 0], ['Brand follows', t.brand_follow ?? 0], ['Reminders', t.reminder_created ?? 0],
    ['Submissions', t.submission_submitted ?? 0], ['Approved', t.submission_approved ?? 0], ['Rejected', t.submission_rejected ?? 0],
  ] as const

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">First-party events only. No IP addresses or user agents are stored. Demo data includes synthetic events marked in metadata.</p>
        </div>
        <nav className="flex gap-1" aria-label="Time range">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/admin/analytics?days=${d}`} className={cn('rounded-full px-3 py-1.5 text-sm', d === days ? 'bg-primary text-primary-foreground' : 'bg-background')}>{d} days</Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-background p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{typeof value === 'number' ? compactNumber(value) : value}</p>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border bg-background p-5">
        <DailyBarChart
          label={`Views, clicks and saves per day over ${days} days`}
          data={lastNDays(days).map((day) => ({ day, values: byDay.get(day) ?? {} }))}
          series={[{ key: 'views', label: 'Views', color: 'var(--chart-2)' }, { key: 'clicks', label: 'Buy clicks', color: 'var(--chart-1)' }, { key: 'saves', label: 'Saves', color: 'var(--chart-3)' }]}
        />
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-x-auto rounded-2xl border bg-background">
          <h2 className="border-b p-4 font-sans text-base font-semibold tracking-normal">Top products</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3 font-medium">Product</th><th className="p-3 text-right font-medium">Views</th><th className="p-3 text-right font-medium">Clicks</th><th className="p-3 text-right font-medium">Saves</th><th className="p-3 text-right font-medium">Shares</th></tr></thead>
            <tbody className="divide-y tabular-nums">
              {(s.top_products ?? []).map((p) => (
                <tr key={p.id}><td className="p-3"><Link href={`/products/${p.slug}`} className="hover:underline">{p.name}</Link></td><td className="p-3 text-right">{p.views}</td><td className="p-3 text-right">{p.clicks}</td><td className="p-3 text-right">{p.saves}</td><td className="p-3 text-right">{p.shares}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="grid gap-6 sm:grid-cols-2">
          {([['Top categories', s.top_categories, 'categories'], ['Top brands', s.top_brands, 'brands']] as const).map(([title, rows, base]) => (
            <section key={title} className="rounded-2xl border bg-background">
              <h2 className="border-b p-4 font-sans text-base font-semibold tracking-normal">{title}</h2>
              <ol className="divide-y text-sm">
                {(rows ?? []).map((r) => <li key={r.slug} className="flex justify-between p-3"><Link href={`/${base}/${r.slug}`} className="hover:underline">{r.name}</Link><span className="tabular-nums text-muted-foreground">{r.events}</span></li>)}
              </ol>
            </section>
          ))}
          <section className="rounded-2xl border bg-background sm:col-span-2">
            <h2 className="border-b p-4 font-sans text-base font-semibold tracking-normal">Top search queries</h2>
            <ol className="flex flex-wrap gap-2 p-4 text-sm">
              {(s.top_searches ?? []).map((q) => <li key={q.query} className="rounded-full bg-muted px-3 py-1">{q.query} <span className="text-muted-foreground">{q.searches}</span></li>)}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
