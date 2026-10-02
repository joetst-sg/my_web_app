import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/basics'
import { DailyBarChart, lastNDays } from '@/components/common/bar-chart'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { requireViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getI18n, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('seller.dashboard.title'), robots: { index: false } }
}

export default async function SellerDashboard({ searchParams }: PageProps<'/seller/dashboard'>) {
  const viewer = await requireViewer('/seller/dashboard')
  const sp = await searchParams
  const supabase = await createClient()
  const { t, f } = await getI18n()
  const [{ data: products }, { data: subs }, { data: stats }] = await Promise.all([
    supabase.from('products').select('id, name, slug, status, view_count, click_count, save_count').eq('seller_id', viewer.id),
    supabase.from('submissions').select('id, status, last_action_at, product:products ( name )').eq('seller_id', viewer.id).order('last_action_at', { ascending: false }).limit(6),
    supabase.rpc('seller_product_stats', { days: 30 }),
  ])
  const list = products ?? []
  const sum = (k: 'view_count' | 'click_count' | 'save_count') => list.reduce((a, p) => a + p[k], 0)
  const tiles = [
    [t('seller.nav.products'), list.length],
    [t('labels.productStatus.published'), list.filter((p) => p.status === 'published').length],
    [t('labels.productStatus.pending_review'), list.filter((p) => p.status === 'pending_review').length],
    [t('labels.productStatus.changes_requested'), list.filter((p) => p.status === 'changes_requested').length],
    [t('seller.stats.views'), sum('view_count')],
    [t('seller.stats.clicks'), sum('click_count')],
    [t('seller.stats.saves'), sum('save_count')],
  ] as const
  const days = lastNDays(30)
  const byDay = new Map<string, { views: number; clicks: number }>()
  for (const s of stats ?? []) {
    const d = byDay.get(s.day) ?? { views: 0, clicks: 0 }
    byDay.set(s.day, { views: d.views + Number(s.views), clicks: d.clicks + Number(s.clicks) })
  }
  const top = [...list].filter((p) => p.status === 'published').sort((a, b) => b.view_count - a.view_count).slice(0, 5)

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{sp.welcome ? t('seller.dashboard.welcome') : t('seller.nav.dashboard')}</h1>
          <p className="mt-1 text-muted-foreground">{t('seller.dashboard.intro')}</p>
        </div>
        <Button asChild size="lg"><Link href="/seller/products/new"><Plus />{t('seller.newProduct')}</Link></Button>
      </div>

      {list.length === 0 ? (
        <EmptyState title={t('seller.noProducts')} description={t('seller.dashboard.emptyBody')} action={<Button asChild size="lg"><Link href="/seller/products/new">{t('seller.dashboard.createFirst')}</Link></Button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {tiles.map(([label, value]) => (
              <div key={label} className="rounded-2xl border p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums">{f.compact(value)}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border p-5">
            <h2 className="mb-4 font-sans text-base font-semibold tracking-normal">{t('seller.stats.last30')}</h2>
            <DailyBarChart
              label={t('seller.dashboard.chartLabel')}
              dayLabel={t('seller.stats.day')}
              data={days.map((day) => ({ day, values: byDay.get(day) ?? { views: 0, clicks: 0 } }))}
              series={[{ key: 'views', label: t('seller.stats.views'), color: 'var(--chart-2)' }, { key: 'clicks', label: t('seller.stats.clicks'), color: 'var(--chart-1)' }]}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="font-sans text-base font-semibold tracking-normal">{t('seller.dashboard.recent')}</h2>
                <Link href="/seller/submissions" className="text-sm underline underline-offset-4">{t('account.notifications.all')}</Link>
              </div>
              <ul className="divide-y">
                {(subs ?? []).map((s) => (
                  <li key={s.id}>
                    <Link href={`/seller/submissions/${s.id}`} className="flex items-center gap-3 p-4 hover:bg-surface">
                      <span className="min-w-0 flex-1 truncate font-medium">{s.product?.name}</span>
                      <span className="text-xs text-muted-foreground">{f.timeAgo(s.last_action_at)}</span>
                      <SubmissionStatusBadge status={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="font-sans text-base font-semibold tracking-normal">{t('seller.dashboard.performance')}</h2>
                <Link href="/seller/analytics" className="text-sm underline underline-offset-4">{t('seller.dashboard.details')}</Link>
              </div>
              {top.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">{t('seller.dashboard.statsLater')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr><th className="p-4 font-medium">{t('seller.stats.product')}</th><th className="p-4 text-right font-medium">{t('seller.stats.views')}</th><th className="p-4 text-right font-medium">{t('seller.stats.clicksShort')}</th><th className="p-4 text-right font-medium">{t('seller.stats.ctr')}</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {top.map((p) => (
                      <tr key={p.id}>
                        <td className="p-4"><Link href={`/products/${p.slug}`} className="font-medium hover:underline">{p.name}</Link></td>
                        <td className="p-4 text-right tabular-nums">{p.view_count}</td>
                        <td className="p-4 text-right tabular-nums">{p.click_count}</td>
                        <td className="p-4 text-right tabular-nums">{p.view_count ? `${((p.click_count / p.view_count) * 100).toFixed(1)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
