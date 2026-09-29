import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageForm } from '@/components/common/message-form'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { SubmissionTimeline } from '@/components/common/submission-timeline'
import { requireViewer } from '@/lib/auth'
import { getSubmission } from '@/lib/db/submissions'
import { formatDateTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { WithdrawButton } from './withdraw'

export const metadata: Metadata = { title: 'Submission', robots: { index: false } }

const explain: Record<string, string> = {
  draft: 'This is a draft. Finish the steps and submit it when you’re ready.',
  submitted: 'Your product is in the review queue. Editors usually respond within a few days.',
  under_review: 'An editor is reviewing your product now.',
  changes_requested: 'Editors asked for changes. Update your product and resubmit it.',
  approved: 'Approved! An editor will schedule or publish it soon.',
  scheduled: 'Approved and scheduled. It will go live automatically at the scheduled time.',
  published: 'Your product is live.',
  rejected: 'This submission was not accepted. See the editor’s message below.',
  archived: 'This product has been archived and is no longer shown.',
}

export default async function SellerSubmissionPage({ params }: PageProps<'/seller/submissions/[id]'>) {
  const { id } = await params
  await requireViewer(`/seller/submissions/${id}`)
  const data = await getSubmission(id)
  if (!data) notFound()
  const { submission: s, timeline, latestRequest } = data
  const supabase = await createClient()
  const { data: product } = await supabase.from('products').select('id, name, slug').eq('id', s.product_id).single()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow"><Link href="/seller/submissions" className="hover:text-foreground">Submissions</Link></p>
          <h1 className="mt-1 font-display text-3xl font-bold">{product?.name}</h1>
        </div>
        <SubmissionStatusBadge status={s.status} />
      </div>
      <div className="rounded-2xl bg-surface p-5">
        <p>{explain[s.status]}</p>
        {s.status === 'scheduled' && s.scheduled_for && <p className="mt-1 text-sm text-muted-foreground">Scheduled for {formatDateTime(s.scheduled_for)} UTC</p>}
        {latestRequest?.message && (s.status === 'changes_requested' || s.status === 'rejected') && (
          <blockquote className="mt-3 border-l-4 border-highlight pl-4 text-sm">{latestRequest.message}</blockquote>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {(s.status === 'draft' || s.status === 'changes_requested') && (
            <Button asChild><Link href={`/seller/products/${s.product_id}/edit${s.status === 'changes_requested' ? '?step=1' : ''}`}>{s.status === 'draft' ? 'Continue editing' : 'Update product'}</Link></Button>
          )}
          {s.status === 'submitted' && <WithdrawButton submissionId={s.id} />}
          {s.status === 'published' && product && <Button asChild variant="outline"><Link href={`/products/${product.slug}`}>View live</Link></Button>}
          <Button asChild variant="outline"><Link href={`/seller/products/${s.product_id}`}>Preview</Link></Button>
        </div>
      </div>
      <section aria-labelledby="history-h" className="flex flex-col gap-4">
        <h2 id="history-h" className="font-sans text-lg font-semibold tracking-normal">History & messages</h2>
        <SubmissionTimeline entries={timeline} />
        {s.status !== 'draft' && <MessageForm submissionId={s.id} placeholder="Reply to the editors…" />}
      </section>
    </div>
  )
}
