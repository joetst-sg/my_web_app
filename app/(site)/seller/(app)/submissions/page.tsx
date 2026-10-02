import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { FileClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/basics'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { requireViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getI18n, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('seller.nav.submissions'), robots: { index: false } }
}

export default async function SellerSubmissionsPage() {
  const viewer = await requireViewer('/seller/submissions')
  const supabase = await createClient()
  const { t, f } = await getI18n()
  const { data } = await supabase
    .from('submissions')
    .select('id, status, submitted_at, last_action_at, scheduled_for, product:products ( id, name )')
    .eq('seller_id', viewer.id)
    .order('last_action_at', { ascending: false })
  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('seller.nav.submissions')}</h1>
      <p className="mb-8 mt-1 text-muted-foreground">{t('seller.submissions.intro')}</p>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={FileClock} title={t('seller.noProducts')} action={<Button asChild><Link href="/seller/products/new">{t('seller.products.create')}</Link></Button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-xs text-muted-foreground">
              <tr><th className="p-4 font-medium">{t('seller.stats.product')}</th><th className="p-4 font-medium">{t('seller.submissions.status')}</th><th className="p-4 font-medium">{t('seller.submissions.submitted')}</th><th className="p-4 font-medium">{t('seller.submissions.lastUpdate')}</th></tr>
            </thead>
            <tbody className="divide-y">
              {data!.map((s) => (
                <tr key={s.id} className="hover:bg-surface">
                  <td className="p-4"><Link href={`/seller/submissions/${s.id}`} className="font-medium hover:underline">{s.product?.name}</Link></td>
                  <td className="p-4"><SubmissionStatusBadge status={s.status} />{s.status === 'scheduled' && s.scheduled_for && <span className="ml-2 text-xs text-muted-foreground">{f.date(s.scheduled_for)}</span>}</td>
                  <td className="p-4 text-muted-foreground">{s.submitted_at ? f.date(s.submitted_at) : '—'}</td>
                  <td className="p-4 text-muted-foreground">{f.timeAgo(s.last_action_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
