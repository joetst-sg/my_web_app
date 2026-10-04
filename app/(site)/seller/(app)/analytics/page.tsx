import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { DailyBarChart, lastNDays } from '@/components/common/bar-chart'
import { requireViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('seller.analytics.title'), robots: { index: false } }
}

export default async function SellerAnalyticsPage() {
  const viewer = await requireViewer('/seller/analytics')
  const supabase = await createClient()
  const t = await getT()
  const [{ data: products }, { data: stats }] = await Promise.all([
    supabase.from('products').select('id, name, slug, view_count, click_count, save_count, share_count').eq('seller_id', viewer.id).eq('status', 'published'),
    supabase.rpc('seller_product_stats', { days: 30 }),
  ])
  if (!products?.length) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('seller.nav.analytics')}</h1>
        <EmptyState className="mt-8" icon={BarChart3} title={t('seller.analytics.emptyTitle')} description={t('seller.analytics.emptyBody')} />
      </div>
    )
  }
  const days = lastNDays(30)
  const byDay = new Map<string, { views: number; clicks: number; saves: number }>()
  const byProduct = new Map<string, { views: number; clicks: number; saves: number }>()
  for (const s of stats ?? []) {
    const d = byDay.get(s.day) ?? { views: 0, clicks: 0, saves: 0 }
    byDay.set(s.day, { views: d.views + Number(s.views), clicks: d.clicks + Number(s.clicks), saves: d.saves + Number(s.saves) })
    const p = byProduct.get(s.product_id) ?? { views: 0, clicks: 0, saves: 0 }
    byProduct.set(s.product_id, { views: p.views + Number(s.views), clicks: p.clicks + Number(s.clicks), saves: p.saves + Number(s.saves) })
  }
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('seller.nav.analytics')}</h1>
        <p className="mt-1 text-muted-foreground">{t('seller.analytics.intro')}</p>
      </div>
      <section className="rounded-2xl border p-5">
        <h2 className="mb-4 font-sans text-base font-semibold tracking-normal">{t('seller.stats.last30')}</h2>
        <DailyBarChart
          label={t('seller.analytics.chartLabel')}
          dayLabel={t('seller.stats.day')}
          data={days.map((day) => ({ day, values: byDay.get(day) ?? {} }))}
          series={[
            { key: 'views', label: t('seller.stats.views'), color: 'var(--chart-2)' },
            { key: 'clicks', label: t('seller.stats.clicks'), color: 'var(--chart-1)' },
            { key: 'saves', label: t('seller.stats.saves'), color: 'var(--chart-3)' },
          ]}
        />
      </section>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-4 font-medium">{t('seller.stats.product')}</th>
              <th className="p-4 text-right font-medium">{t('seller.analytics.views30')}</th>
              <th className="p-4 text-right font-medium">{t('seller.analytics.clicks30')}</th>
              <th className="p-4 text-right font-medium">{t('seller.analytics.conversion')}</th>
              <th className="p-4 text-right font-medium">{t('seller.analytics.allTime')}</th>
              <th className="p-4 text-right font-medium">{t('seller.stats.saves')}</th>
              <th className="p-4 text-right font-medium">{t('seller.analytics.shares')}</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {products.map((p) => {
              const m = byProduct.get(p.id) ?? { views: 0, clicks: 0, saves: 0 }
              return (
                <tr key={p.id}>
                  <td className="p-4"><Link href={`/products/${p.slug}`} className="font-medium hover:underline">{p.name}</Link></td>
                  <td className="p-4 text-right">{m.views}</td>
                  <td className="p-4 text-right">{m.clicks}</td>
                  <td className="p-4 text-right">{m.views ? `${((m.clicks / m.views) * 100).toFixed(1)}%` : '—'}</td>
                  <td className="p-4 text-right">{p.view_count}</td>
                  <td className="p-4 text-right">{p.save_count}</td>
                  <td className="p-4 text-right">{p.share_count}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
