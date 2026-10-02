import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageForm } from '@/components/common/message-form'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { SubmissionTimeline } from '@/components/common/submission-timeline'
import { requireViewer } from '@/lib/auth'
import { getSubmission } from '@/lib/db/submissions'
import { createClient } from '@/lib/supabase/server'
import { WithdrawButton } from './withdraw'
import { getI18n, getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('seller.submission.title'), robots: { index: false } }
}

const explain = (status: string) => `seller.explain.${status}` as MessageKey

export default async function SellerSubmissionPage({ params }: PageProps<'/seller/submissions/[id]'>) {
  const { id } = await params
  await requireViewer(`/seller/submissions/${id}`)
  const data = await getSubmission(id)
  if (!data) notFound()
  const { submission: s, timeline, latestRequest } = data
  const supabase = await createClient()
  const { t, f } = await getI18n()
  const { data: product } = await supabase.from('products').select('id, name, slug').eq('id', s.product_id).single()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow"><Link href="/seller/submissions" className="hover:text-foreground">{t('seller.nav.submissions')}</Link></p>
          <h1 className="mt-1 font-display text-3xl font-bold">{product?.name}</h1>
        </div>
        <SubmissionStatusBadge status={s.status} />
      </div>
      <div className="rounded-2xl bg-surface p-5">
        <p>{t(explain(s.status))}</p>
        {s.status === 'scheduled' && s.scheduled_for && <p className="mt-1 text-sm text-muted-foreground">{t('seller.submission.scheduledFor', { date: f.dateTime(s.scheduled_for) })}</p>}
        {latestRequest?.message && (s.status === 'changes_requested' || s.status === 'rejected') && (
          <blockquote className="mt-3 border-l-4 border-highlight pl-4 text-sm">{latestRequest.message}</blockquote>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {(s.status === 'draft' || s.status === 'changes_requested') && (
            <Button asChild><Link href={`/seller/products/${s.product_id}/edit${s.status === 'changes_requested' ? '?step=1' : ''}`}>{s.status === 'draft' ? t('seller.submission.continue') : t('seller.submission.update')}</Link></Button>
          )}
          {s.status === 'submitted' && <WithdrawButton submissionId={s.id} />}
          {s.status === 'published' && product && <Button asChild variant="outline"><Link href={`/products/${product.slug}`}>{t('common.viewLive')}</Link></Button>}
          <Button asChild variant="outline"><Link href={`/seller/products/${s.product_id}`}>{t('seller.submission.preview')}</Link></Button>
        </div>
      </div>
      <section aria-labelledby="history-h" className="flex flex-col gap-4">
        <h2 id="history-h" className="font-sans text-lg font-semibold tracking-normal">{t('seller.submission.history')}</h2>
        <SubmissionTimeline entries={timeline} />
        {s.status !== 'draft' && <MessageForm submissionId={s.id} placeholder={t('messages.replyToEditors')} />}
      </section>
    </div>
  )
}
